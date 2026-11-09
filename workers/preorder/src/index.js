// v/h pre-order sign-ups.
// POST /preorder  { email, price, size, company?, source? }  -> stores one record per email in KV.
// GET  /export    Authorization: Bearer <ADMIN_TOKEN>        -> CSV of every sign-up.
// DELETE /preorder?email=<address>  Authorization: Bearer <ADMIN_TOKEN> -> erases one person's record.
// No IP address is stored. Country comes from Cloudflare's request metadata.

const CONSENT_VERSION = '2026-11-09';  // bump when the privacy notice or the form's consent text changes

const ALLOWED_ORIGINS = ['https://vh.do', 'https://www.vh.do'];
const PRICES = ['under-50', '50-100', '100-200', 'over-200'];
const SIZES = ['small', 'medium', 'large'];
const CURRENCIES = ['USD', 'GBP', 'EUR', 'INR', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'JPY', 'CHF'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function cors(origin) {
  return ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    if (url.pathname === '/preorder' && request.method === 'POST') {
      if (!headers['Access-Control-Allow-Origin']) return json({ error: 'origin not allowed' }, 403, headers);
      let data;
      try { data = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, headers); }
      // Honeypot: real people never fill the hidden "company" field. Pretend success for bots.
      if (data.company) return json({ ok: true }, 200, headers);
      const email = String(data.email || '').trim().toLowerCase();
      if (!EMAIL.test(email)) return json({ error: 'invalid email' }, 400, headers);
      if (!PRICES.includes(data.price)) return json({ error: 'invalid price' }, 400, headers);
      if (!SIZES.includes(data.size)) return json({ error: 'invalid size' }, 400, headers);
      const existing = await env.PREORDERS.get(`preorder:${email}`, 'json');
      const now = new Date().toISOString();
      await env.PREORDERS.put(`preorder:${email}`, JSON.stringify({
        email, price: data.price, size: data.size,
        currency: CURRENCIES.includes(data.currency) ? data.currency : 'USD',
        source: String(data.source || '').slice(0, 80),
        country: request.cf?.country || '',
        consentVersion: CONSENT_VERSION,
        createdAt: existing?.createdAt || now, updatedAt: now,
      }));
      return json({ ok: true }, 200, headers);
    }

    const isAdmin = env.ADMIN_TOKEN && request.headers.get('Authorization') === `Bearer ${env.ADMIN_TOKEN}`;

    if (url.pathname === '/preorder' && request.method === 'DELETE') {
      if (!isAdmin) return new Response('Unauthorized', { status: 401 });
      const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
      if (!EMAIL.test(email)) return json({ error: 'invalid email' }, 400, {});
      const existed = (await env.PREORDERS.get(`preorder:${email}`)) !== null;
      await env.PREORDERS.delete(`preorder:${email}`);
      return json({ ok: true, deleted: existed }, 200, {});
    }

    if (url.pathname === '/export' && request.method === 'GET') {
      if (!isAdmin) return new Response('Unauthorized', { status: 401 });
      const rows = [['email', 'price', 'currency', 'size', 'country', 'source', 'consentVersion', 'createdAt', 'updatedAt']];
      let cursor;
      do {
        const page = await env.PREORDERS.list({ prefix: 'preorder:', cursor });
        for (const key of page.keys) {
          const r = await env.PREORDERS.get(key.name, 'json');
          if (r) rows.push([r.email, r.price, r.currency, r.size, r.country, r.source, r.consentVersion, r.createdAt, r.updatedAt]);
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="vh-preorders.csv"' } });
    }

    return new Response('Not found', { status: 404 });
  },
};
