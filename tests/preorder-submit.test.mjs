import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { submitInterest } from '../preorder-submit.mjs';
async function endpoint(t, status, body) {
  let received;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    received = { method: req.method, data: JSON.parse(raw), type: req.headers['content-type'] };
    res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { url: `http://127.0.0.1:${server.address().port}`, received: () => received };
}
test('submits explicit consent and succeeds only on a confirmed service response', async t => {
  const server = await endpoint(t, 200, '{"ok":true}');
  const data = { email: 'reader@example.com', consent: true };
  assert.deepEqual(await submitInterest(server.url, data), { ok: true });
  assert.deepEqual(server.received(), { method: 'POST', type: 'application/json', data });
});
for (const [status, body] of [[200, '{}'], [200, '{"ok":false}'], [200, 'not json'], [503, '{"ok":true}'], [429, '{"error":"rate"}']]) {
  test(`does not show saved after HTTP ${status} with ${body}`, async t => {
    const server = await endpoint(t, status, body);
    await assert.rejects(submitInterest(server.url, { email: 'reader@example.com', consent: true }));
  });
}
test('aborted requests reject so the form can offer a safe retry', async t => {
  const server = await endpoint(t, 200, '{"ok":true}');
  await assert.rejects(submitInterest(server.url, {}, AbortSignal.abort()));
});
