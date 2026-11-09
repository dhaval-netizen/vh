import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../workers/preorder/src/index.js';

// Execute the production SQL against SQLite. Only the Cloudflare binding API is adapted.
function fixture(t, limited = false) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../workers/preorder/migrations/0001_signups.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const DB = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    const bound = args => ({
      bind: (...values) => bound(values),
      first: async () => statement.get(...args) || null,
      all: async () => ({ results: statement.all(...args) }),
      run: async () => ({ meta: statement.run(...args) }),
    });
    return bound([]);
  }};
  return { sqlite, env: { DB, ADMIN_TOKEN: 'test-secret-with-at-least-32-characters', WRITE_LIMITER: { limit: async () => ({ success: !limited }) } } };
}
const valid = { email: 'reader@example.com', consent: true, price: '', size: '', company: '' };
const request = (body = valid, { origin = 'https://vh.do', type = 'application/json', method = 'POST', path = '/preorder', headers = {} } = {}) => new Request(`https://worker.test${path}`, { method, headers: { Origin: origin, 'Content-Type': type, 'CF-Connecting-IP': '192.0.2.1', ...headers }, ...(body === undefined || method === 'GET' || method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }) });
const admin = (env, path = '/export', method = 'GET', body) => request(body, { path, method, headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` } });

for (const body of [null, [], 'hello', 7]) test(`rejects non-object JSON ${JSON.stringify(body)} with a client error`, async t => {
  const { env } = fixture(t);
  assert.equal((await worker.fetch(request(body), env)).status, 400);
});
test('requires explicit consent before storing an email', async t => {
  const { env, sqlite } = fixture(t);
  const res = await worker.fetch(request({ ...valid, price: 'under-50', size: 'small', consent: false }), env);
  assert.equal(res.status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM signups').get().n, 0);
});
test('accepts email and consent with no survey answers and retains it for 365 days', async t => {
  const { env, sqlite } = fixture(t);
  const res = await worker.fetch(request({ email: ' Reader@Example.com ', consent: true }), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const row = sqlite.prepare('SELECT * FROM signups').get();
  assert.equal(row.email, 'reader@example.com');
  assert.equal(row.price, '');
  assert.equal(row.expires_at - row.created_at, 365 * 86400);
});
test('rejects invalid field types and invalid survey values', async t => {
  const { env } = fixture(t);
  for (const fields of [{ email: {} }, { consent: 'true' }, { price: 'free' }, { size: ['small'] }, { company: 7 }, { email: '=cmd@example.com' }]) {
    assert.equal((await worker.fetch(request({ ...valid, ...fields }), env)).status, 400, JSON.stringify(fields));
  }
});
test('rejects large bodies even without a Content-Length header', async t => {
  const { env } = fixture(t);
  assert.equal((await worker.fetch(request({ ...valid, extra: 'x'.repeat(3000) }), env)).status, 413);
});
test('only accepts JSON and the exact public site origins', async t => {
  const { env } = fixture(t);
  assert.equal((await worker.fetch(request(valid, { type: 'text/plain' }), env)).status, 415);
  assert.equal((await worker.fetch(request(valid, { origin: 'https://vh.do.evil.test' }), env)).status, 403);
  const res = await worker.fetch(request(undefined, { method: 'OPTIONS' }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://vh.do');
  assert.equal((await worker.fetch(request(undefined, { method: 'OPTIONS', path: '/export' }), env)).status, 404);
});
test('honeypot returns generic success without creating a record', async t => {
  const { env, sqlite } = fixture(t);
  assert.equal((await worker.fetch(request({ ...valid, company: 'bot' }), env)).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM signups').get().n, 0);
});
test('rate-limited submissions return retry guidance and are not stored', async t => {
  const { env, sqlite } = fixture(t, true);
  const res = await worker.fetch(request(valid), env);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('Retry-After'), '60');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM signups').get().n, 0);
});
test('duplicates are idempotent and cannot replace another person’s preferences or extend retention', async t => {
  const { env, sqlite } = fixture(t);
  await worker.fetch(request({ ...valid, size: 'small' }), env);
  const before = sqlite.prepare('SELECT * FROM signups').get();
  assert.equal((await worker.fetch(request({ ...valid, size: 'large' }), env)).status, 200);
  assert.deepEqual(sqlite.prepare('SELECT * FROM signups').get(), before);
});
test('unauthorized callers cannot export or delete and errors are never cached', async t => {
  const { env } = fixture(t);
  for (const [path, method] of [['/export', 'GET'], ['/preorder', 'DELETE']]) {
    const res = await worker.fetch(request(valid, { path, method }), env);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }
});
test('authenticated export omits expired entries and neutralizes spreadsheet formulas', async t => {
  const { env, sqlite } = fixture(t);
  const now = Math.floor(Date.now() / 1000);
  const insert = sqlite.prepare('INSERT INTO signups(email, price, size, consent_version, created_at, expires_at) VALUES (?,?,?,?,?,?)');
  insert.run('=1+1@example.com', '', '', '@legacy', now, now + 100);
  insert.run('expired@example.com', '', '', 'old', now - 100, now - 1);
  const res = await worker.fetch(admin(env), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const csv = await res.text();
  assert.match(csv, /"'=1\+1@example.com"/);
  assert.match(csv, /"'@legacy"/);
  assert.doesNotMatch(csv, /expired@example.com/);
});
test('export has bounded pages with a cursor, without losing records', async t => {
  const { env, sqlite } = fixture(t);
  const now = Math.floor(Date.now() / 1000);
  const insert = sqlite.prepare('INSERT INTO signups(email, consent_version, created_at, expires_at) VALUES (?,?,?,?)');
  for (let i = 0; i < 501; i++) insert.run(`reader${i}@example.com`, 'test', now, now + 100);
  const first = await worker.fetch(admin(env), env);
  const cursor = first.headers.get('X-Next-Cursor');
  assert.ok(cursor);
  assert.equal((await first.text()).trim().split('\n').length, 501);
  const next = await worker.fetch(admin(env, `/export?after=${cursor}`), env);
  assert.match(await next.text(), /reader500@example.com/);
  assert.equal(next.headers.get('X-Next-Cursor'), null);
});
test('admin can erase a signup by JSON body without putting email in a URL', async t => {
  const { env, sqlite } = fixture(t);
  await worker.fetch(request(valid), env);
  const res = await worker.fetch(admin(env, '/preorder', 'DELETE', { email: valid.email }), env);
  assert.equal(res.status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM signups').get().n, 0);
});
test('daily cleanup removes expired records and preserves current consent', async t => {
  const { env, sqlite } = fixture(t);
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare('INSERT INTO signups(email, consent_version, created_at, expires_at) VALUES (?,?,?,?)').run('old@example.com', 'old', now - 200, now - 1);
  await worker.fetch(request(valid), env);
  await worker.scheduled({}, env);
  assert.deepEqual(sqlite.prepare('SELECT email FROM signups').all().map(r => r.email), [valid.email]);
});
test('daily capacity fails clearly instead of silently dropping a signup', async t => {
  const { env, sqlite } = fixture(t);
  const now = Math.floor(Date.now() / 1000);
  const insert = sqlite.prepare('INSERT INTO signups(email, consent_version, created_at, expires_at) VALUES (?,?,?,?)');
  for (let i = 0; i < 1000; i++) insert.run(`capacity${i}@example.com`, 'test', now, now + 100);
  assert.equal((await worker.fetch(request(valid), env)).status, 503);
});
test('storage failure produces a retryable response without exposing internals', async t => {
  const { env, sqlite } = fixture(t);
  sqlite.exec('DROP TABLE signups');
  const res = await worker.fetch(request(valid), env);
  assert.equal(res.status, 503);
  assert.doesNotMatch(await res.text(), /SQL|table|stack/i);
});
