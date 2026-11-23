import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import preorder from '../workers/preorder/src/index.js';
import welcome, { welcomeEmail } from '../workers/welcome/src/index.js';

const MIGRATIONS = ['0001_signups.sql', '0002_country_referral.sql', '0003_welcome_sent.sql'];
function fixture(t, extra = {}) {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of MIGRATIONS) sqlite.exec(readFileSync(new URL(`../workers/preorder/migrations/${file}`, import.meta.url), 'utf8'));
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
  const queued = [];
  const env = {
    DB, WRITE_LIMITER: { limit: async () => ({ success: true }) }, REF_SECRET: 'referral-secret-with-at-least-32-chars',
    WELCOME_QUEUE: { send: async body => queued.push(body) },
    RESEND_API_KEY: 're_test', FROM: 'v/h <hello@vh.do>', REPLY_TO: 'vedh@vh.do', ALLOWLIST: '', ...extra,
  };
  return { sqlite, env, queued };
}
const signup = (email, extra = {}) => new Request('https://worker.test/preorder', {
  method: 'POST', headers: { Origin: 'https://vh.do', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
  body: JSON.stringify({ email, consent: true, price: '', size: '', company: '', ...extra }),
});
function batch(ids) {
  const out = { acked: [], retried: [] };
  out.messages = ids.map(id => ({ body: { id }, ack: () => out.acked.push(id), retry: () => out.retried.push(id) }));
  return out;
}
function mockFetch(t, status = 200) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return new Response('{"id":"x"}', { status }); };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

test('a new signup is queued by id only; a repeat signup is not queued again', async t => {
  const { env, queued } = fixture(t);
  await preorder.fetch(signup('a@example.com'), env);
  await preorder.fetch(signup('a@example.com'), env);
  assert.deepEqual(queued, [{ id: 1 }]);
});
test('a queue failure never fails the signup', async t => {
  const { env, sqlite } = fixture(t, { WELCOME_QUEUE: { send: async () => { throw new Error('down'); } } });
  assert.equal((await preorder.fetch(signup('a@example.com'), env)).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM signups').get().n, 1);
});
test('the mailer sends one email with the personal share link and marks the row', async t => {
  const { env, sqlite, queued } = fixture(t);
  const { ref } = await (await preorder.fetch(signup('a@example.com'), env)).json();
  const calls = mockFetch(t);
  const b = batch(queued.map(q => q.id));
  await welcome.queue(b, env);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.deepEqual(calls[0].body.to, ['a@example.com']);
  assert.match(calls[0].body.text, new RegExp(`https://vh.do/lamp/\\?r=${ref}`));
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'vh-welcome-1');
  assert.deepEqual(b.acked, [1]);
  assert.ok(sqlite.prepare('SELECT welcome_sent_at FROM signups').get().welcome_sent_at > 0);
});
test('a row is never mailed twice, even if its id is queued twice', async t => {
  const { env } = fixture(t);
  await preorder.fetch(signup('a@example.com'), env);
  const calls = mockFetch(t);
  await welcome.queue(batch([1, 1]), env);
  await welcome.queue(batch([1]), env);
  assert.equal(calls.length, 1);
});
test('while the allowlist is set, other addresses are held and stay unsent', async t => {
  const { env, sqlite } = fixture(t, { ALLOWLIST: 'dhaval@vh.do' });
  await preorder.fetch(signup('stranger@example.com'), env);
  await preorder.fetch(signup('Dhaval@vh.do'), env);
  const calls = mockFetch(t);
  const b = batch([1, 2]);
  await welcome.queue(b, env);
  assert.deepEqual(calls.map(c => c.body.to[0]), ['dhaval@vh.do']);
  assert.deepEqual(b.acked, [1, 2]);
  assert.equal(sqlite.prepare('SELECT welcome_sent_at FROM signups WHERE id = 1').get().welcome_sent_at, null);
});
test('a temporary Resend failure releases the row and retries', async t => {
  const { env, sqlite } = fixture(t);
  await preorder.fetch(signup('a@example.com'), env);
  mockFetch(t, 503);
  const b = batch([1]);
  await welcome.queue(b, env);
  assert.deepEqual(b.retried, [1]);
  assert.equal(sqlite.prepare('SELECT welcome_sent_at FROM signups').get().welcome_sent_at, null);
});
test('erased or expired signups are skipped', async t => {
  const { env, sqlite } = fixture(t);
  await preorder.fetch(signup('a@example.com'), env);
  sqlite.exec('DELETE FROM signups');
  const calls = mockFetch(t);
  const b = batch([1, 'junk']);
  await welcome.queue(b, env);
  assert.equal(calls.length, 0);
  assert.equal(b.acked.length, 2);
});
test('the email copy has no em dashes and always carries an unsubscribe line', () => {
  const { text } = welcomeEmail('', 'vedh@vh.do');
  assert.doesNotMatch(text, /—/);
  assert.match(text, /To unsubscribe, reply "unsubscribe" or email vedh@vh\.do/);
  assert.match(text, /join at https:\/\/vh\.do\/lamp\//);
});
