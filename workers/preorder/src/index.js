// Lamp interest list. No orders, payments or automated email sending.
// Stores country (from Cloudflare, country only) and a referral code per signup.
const ORIGINS = new Set(['https://vh.do', 'https://www.vh.do']);
const CONSENT_VERSION = '2026-11-23-interest-v2';
const RETENTION = 365 * 86400;
const MAX_BODY = 2048;
const EMAIL = /^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]{0,63}@[a-z0-9](?:[a-z0-9.-]{0,188}[a-z0-9])?\.[a-z]{2,24}$/i;
const PRICES = new Set(['', 'under-50', '50-100', '100-200', 'over-200']);
const SIZES = new Set(['', 'small', 'medium', 'large']);
const REF = /^[a-z2-7]{10}$/;
const COUNTRY = /^[A-Z][A-Z0-9]$/;
const encoder = new TextEncoder();

function headers(origin) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
    ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {}) };
}
function json(body, status, h) {
  return new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } });
}
function invalid(status, message) { return Object.assign(new Error(message), { status }); }
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw invalid(415, 'Use application/json.');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw invalid(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw invalid(400, 'A JSON object is required.');
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) { await reader.cancel(); throw invalid(413, 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw invalid(400, 'Invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw invalid(400, 'A JSON object is required.');
  return data;
}
function emailAddress(value) {
  if (typeof value !== 'string') throw invalid(400, 'Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email) || email.includes('..')) throw invalid(400, 'Enter a valid email address.');
  return email;
}
async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
async function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return false;
  const supplied = request.headers.get('Authorization') || '';
  const [a, b] = await Promise.all([digest(supplied), digest(`Bearer ${env.ADMIN_TOKEN}`)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
// Referral code is an HMAC of the email, so a repeat signup gets the same code back
// without a lookup. New and existing members see identical replies.
async function referralCode(email, env) {
  if (!env.REF_SECRET || env.REF_SECRET.length < 32) return '';
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.REF_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(email)));
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, out = '';
  for (const byte of mac) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5 && out.length < 10) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
    if (out.length === 10) break;
  }
  return out;
}
function countryOf(request) {
  const country = request.cf?.country;
  return typeof country === 'string' && COUNTRY.test(country) ? country : '';
}
function cell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const h = headers(origin);
    const now = Math.floor(Date.now() / 1000);
    try {
      if (url.pathname === '/preorder' && request.method === 'OPTIONS') {
        return new Response(null, { status: ORIGINS.has(origin) ? 204 : 403, headers: h });
      }
      if (url.pathname === '/preorder' && request.method === 'POST') {
        if (!ORIGINS.has(origin)) return json({ error: 'Origin not allowed.' }, 403, h);
        // Native rate limiter is local to a Cloudflare location. The database cap below
        // also bounds successful new registrations across all locations.
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const key = Array.from(await digest(ip), b => b.toString(16).padStart(2, '0')).join('');
        if (!(await env.WRITE_LIMITER.limit({ key })).success) return json({ error: 'Please wait a minute and try again.' }, 429, { ...h, 'Retry-After': '60' });
        const data = await readBody(request);
        if (data.company !== undefined && typeof data.company !== 'string') throw invalid(400, 'Invalid form.');
        if (data.company) return json({ ok: true, ...(env.REF_SECRET ? { ref: await referralCode(`trap:${data.company}`, env) } : {}) }, 200, h);
        const email = emailAddress(data.email);
        if (data.consent !== true) throw invalid(400, 'Please agree to receive lamp updates.');
        const price = data.price ?? '', size = data.size ?? '';
        if (!PRICES.has(price) || !SIZES.has(size)) throw invalid(400, 'Invalid preference.');
        const ref = await referralCode(email, env);
        // A broken or self referral link never blocks a signup; it is just not recorded.
        const referredBy = typeof data.ref === 'string' && REF.test(data.ref) && data.ref !== ref ? data.ref : '';
        const country = countryOf(request);
        // Retry is safe. An unverified visitor cannot rewrite an existing person's choices
        // or extend their retention. Expired consent is removed before a fresh signup.
        await env.DB.prepare('DELETE FROM signups WHERE email = ? AND expires_at <= ?').bind(email, now).run();
        const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO signups (email, price, size, country, ref_code, referred_by, consent_version, created_at, expires_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM signups WHERE created_at > ?) < 1000`)
          .bind(email, price, size, country, ref, referredBy, CONSENT_VERSION, now, now + RETENTION, now - 86400).run();
        const saved = await env.DB.prepare('SELECT id FROM signups WHERE email = ? AND expires_at > ?').bind(email, now).first();
        if (!saved) return json({ error: 'The list is temporarily busy. Please try again later.' }, 503, { ...h, 'Retry-After': '3600' });
        // Hand new signups to the welcome email worker. Only the row id goes on the queue.
        // A queue failure never fails the signup; the row keeps welcome_sent_at NULL.
        if (inserted?.meta?.changes === 1 && env.WELCOME_QUEUE) {
          try { await env.WELCOME_QUEUE.send({ id: saved.id }); } catch {}
        }
        return json({ ok: true, ...(ref ? { ref } : {}) }, 200, h);
      }
      if ((url.pathname === '/export' && request.method === 'GET') || (url.pathname === '/preorder' && request.method === 'DELETE')) {
        if (!(await isAdmin(request, env))) return json({ error: 'Unauthorized.' }, 401, h);
        if (request.method === 'DELETE') {
          const data = await readBody(request);
          const email = emailAddress(data.email);
          await env.DB.prepare('DELETE FROM signups WHERE email = ?').bind(email).run();
          return json({ ok: true }, 200, h);
        }
        const rawCursor = url.searchParams.get('after') || '0';
        if (!/^\d{1,15}$/.test(rawCursor)) throw invalid(400, 'Invalid cursor.');
        const { results } = await env.DB.prepare(`SELECT s.*, CASE WHEN s.ref_code = '' THEN 0 ELSE
            (SELECT count(*) FROM signups r WHERE r.referred_by = s.ref_code AND r.expires_at > ?) END AS referrals
          FROM signups s WHERE s.id > ? AND s.expires_at > ? ORDER BY s.id LIMIT 501`).bind(now, Number(rawCursor), now).all();
        const rows = results.slice(0, 500);
        const fields = ['email', 'price', 'size', 'country', 'ref_code', 'referred_by', 'referrals', 'welcome_sent_at', 'consent_version', 'created_at', 'expires_at'];
        const csv = [fields, ...rows.map(row => fields.map(field => row[field]))].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
        return new Response(csv, { headers: { ...h, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="vh-lamp-interest.csv"', ...(results.length > 500 ? { 'X-Next-Cursor': String(rows.at(-1).id) } : {}) } });
      }
      if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'vh-lamp-interest' }, 200, h);
      return json({ error: 'Not found.' }, 404, h);
    } catch (error) {
      return json({ error: error.status ? error.message : 'We could not save your request. Please try again later.' }, error.status || 503, h);
    }
  },
  async scheduled(_event, env) {
    await env.DB.prepare('DELETE FROM signups WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  },
};
