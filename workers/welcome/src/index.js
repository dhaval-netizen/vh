// Lamp welcome email. Consumes row ids from the vh-lamp-welcome queue, reads the
// signup from D1 and sends one thank-you email through Resend. No other mail.
//
// Safety:
// - Each row is claimed with welcome_sent_at before sending, so a row is mailed once.
// - Resend gets an idempotency key per row, so a retry after a timeout is not a resend.
// - While ALLOWLIST is set, only those addresses are mailed. Everyone else is left
//   unsent (welcome_sent_at stays NULL) so nobody is mailed before the copy is approved.

const RESEND_URL = 'https://api.resend.com/emails';

export function welcomeEmail(shareLink, replyTo) {
  const linkPart = shareLink
    ? `If you know someone who'd like it, here's your personal link:\n${shareLink}\n\n`
    : `If you know someone who'd like it, they can join at https://vh.do/lamp/\n\n`;
  return {
    subject: "You're on the v/h lamp list",
    text: `Hi,

Thanks for joining the list for the v/h lamp.

We're building a lamp that notices when you sit down and switches on, then switches off when you leave. There's no app, no voice and no account to set up. All the learning happens inside the lamp.

It's still in development. We'll email you when there's real progress to show, like prototype footage and first home trials. We won't fill your inbox.

${linkPart}Thank you for being early.

Dhaval, Vedh and Suraj
v/h

Joining the list isn't an order or a reservation. To unsubscribe, reply "unsubscribe" or email ${replyTo}.
`,
  };
}

function allowed(email, env) {
  const list = (env.ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(email);
}

async function sendOne(id, env, now) {
  const row = await env.DB.prepare('SELECT id, email, ref_code, welcome_sent_at FROM signups WHERE id = ? AND expires_at > ?').bind(id, now).first();
  if (!row || row.welcome_sent_at) return 'skip';
  if (!allowed(row.email, env)) return 'held';
  const claim = await env.DB.prepare('UPDATE signups SET welcome_sent_at = ? WHERE id = ? AND welcome_sent_at IS NULL').bind(now, id).run();
  if (claim?.meta?.changes !== 1) return 'skip';
  const shareLink = /^[a-z2-7]{10}$/.test(row.ref_code || '') ? `https://vh.do/lamp/?r=${row.ref_code}` : '';
  const { subject, text } = welcomeEmail(shareLink, env.REPLY_TO);
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vh-welcome-${row.id}` },
      body: JSON.stringify({
        from: env.FROM, to: [row.email], reply_to: env.REPLY_TO, subject, text,
        headers: { 'List-Unsubscribe': `<mailto:${env.REPLY_TO}?subject=unsubscribe>` },
      }),
    });
    if (res.status >= 400 && res.status < 500 && res.status !== 429) return 'rejected';
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    return 'sent';
  } catch (error) {
    // Release the claim so the queue retry can try again.
    await env.DB.prepare('UPDATE signups SET welcome_sent_at = NULL WHERE id = ? AND welcome_sent_at = ?').bind(id, now).run();
    throw error;
  }
}

export default {
  async queue(batch, env) {
    const now = Math.floor(Date.now() / 1000);
    for (const message of batch.messages) {
      const id = Number(message.body?.id);
      if (!Number.isInteger(id) || id < 1) { message.ack(); continue; }
      try {
        await sendOne(id, env, now);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 60 });
      }
    }
  },
  async fetch() {
    return new Response(JSON.stringify({ ok: true, service: 'vh-lamp-welcome' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  },
};
