# v/h pre-order Worker: setup guide

This Worker stores sign-ups from the pre-order form at vh.do/preorder/. It runs on the v/h Cloudflare account, the same one as the private review Worker. Setup takes about 20 minutes.

Until it's deployed, the form on vh.do will show "We couldn't save your pre-order". Everywhere other than vh.do (local copies, previews) the form runs in preview mode and sends nothing.

## What it stores

One record per email address. A repeat sign-up updates the record and keeps the original date.

| Field | Example | Notes |
|---|---|---|
| email | jane@example.com | Lower-cased |
| price | 50-100 | Band key in US dollar terms: under-50, 50-100, 100-200, over-200 |
| currency | GBP | The currency the visitor saw the bands in |
| size | medium | small, medium or large |
| country | GB | From Cloudflare's request metadata. No IP address is stored |
| source | vh.do/preorder | |
| consentVersion | 2026-11-09 | Which privacy notice the person agreed to |
| createdAt, updatedAt | ISO timestamps | |

## 1. Before you start

- Access to the v/h Cloudflare account.
- Node.js 18 or newer on your machine.
- A terminal open in this folder: `workers/preorder`.

## 2. Log in to Cloudflare

```sh
npx wrangler login
```

## 3. Create the storage, restricted to the EU

```sh
npx wrangler kv namespace create PREORDERS --jurisdiction=eu
```

Copy the `id` it prints into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`.

Do this exactly once, with `--jurisdiction=eu`. The jurisdiction can only be set when the namespace is created and cannot be added later. It keeps the stored data in EU data centres, which is what the privacy notice at vh.do/privacy/ promises. The EU is covered by UK adequacy rules, so this works for UK visitors too.

## 4. Set the admin password

```sh
npx wrangler secret put ADMIN_TOKEN
```

Paste a long random string, for example the output of `openssl rand -hex 32`. Keep it in a password manager. It protects the export and delete endpoints. Never commit it.

## 5. Deploy

```sh
npx wrangler deploy
```

Wrangler prints the Worker's URL. The page expects:

```
https://vh-preorder.vh-do.workers.dev/preorder
```

If your URL is different, change `ENDPOINT` at the top of `preorder.js` in the repo root, then run `npm run build`.

**Recommended:** serve the Worker from your own domain, for example `https://api.vh.do/preorder`, in place of workers.dev. In the Cloudflare dashboard go to Workers & Pages, then vh-preorder, then Settings, then Domains & Routes, and add a custom domain. Then update `ENDPOINT` to match. This keeps all traffic on vh.do and lets you add Cloudflare security rules to it.

## 6. Test it

From your terminal (simulates the vh.do form):

```sh
curl -i -X POST https://vh-preorder.vh-do.workers.dev/preorder \
  -H "Origin: https://vh.do" -H "Content-Type: application/json" \
  -d '{"email":"test@vh.do","price":"50-100","currency":"GBP","size":"medium","source":"test"}'
```

Expect `200` and `{"ok":true}`. Then export to check it landed:

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://vh-preorder.vh-do.workers.dev/export -o vh-preorders.csv
```

Delete the test record:

```sh
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "https://vh-preorder.vh-do.workers.dev/preorder?email=test@vh.do"
```

Once the site is merged and live, submit the real form on https://vh.do/preorder/ from a phone and a laptop, and check both appear in the export.

## 7. Spam protection (recommended)

The form has a hidden honeypot field, and the Worker only accepts requests sent from https://vh.do and https://www.vh.do. That stops casual bots, not determined ones. Before you promote the page:

- Add a rate limiting rule in the Cloudflare dashboard (Security, then WAF, then Rate limiting rules): for example, 10 requests per minute per IP to `/preorder`. This needs the custom domain from step 5.
- If spam still gets through, add Cloudflare Turnstile to the form. That is not built yet. Ask and it can be added.

## Data protection: what this setup covers, and what it doesn't

**Covered by the code and this setup**
- Data minimisation: only the fields above. No IP addresses, no cookies, no analytics on the page.
- EU storage via the KV jurisdiction (step 3).
- Right to erasure: the `DELETE /preorder?email=` endpoint.
- Right of access and portability: the `/export` CSV.
- A record of which privacy notice each person agreed to (`consentVersion`).
- A privacy notice at vh.do/privacy/, linked from the form.

**Needs a person to do it**
1. **Confirm the privacy notice.** It names "Vedh Krishnan, operating as v/h" as the controller, with vedh@vh.do as the contact, and promises deletion 12 months after the lamp goes on sale. Change it if any of that is wrong, especially if a company is formed. If you change the wording, bump `CONSENT_VERSION` in `src/index.js` and redeploy.
2. **Cloudflare's data processing terms.** Cloudflare's Data Processing Addendum applies to customer accounts. Check it in the dashboard under Manage Account, then Configurations or Legal, and keep a copy for your records.
3. **Answer requests within one month.** For a deletion request, run the DELETE command above and reply to confirm.
4. **Unsubscribes.** No emails are sent by this system. When you start emailing the list from any tool (Kit, Mailchimp, Buttondown), every email needs an unsubscribe link, and you should delete unsubscribed people from KV or mark them.
5. **Retention.** Put a reminder in the calendar for 12 months after launch to export and then delete everything still stored.
6. **Keep the admin token private.** If it leaks, run `npx wrangler secret put ADMIN_TOKEN` again with a new value.

This is a practical setup for a small pre-order list, not legal advice. If you start taking payments or the list grows large, get a short review from a privacy lawyer.
