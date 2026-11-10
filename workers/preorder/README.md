# Lamp interest-list service

`POST /preorder` saves interest in the lamp. The path is retained for the existing integration; this service does not take orders, reserve inventory, charge money or send email. The frontend is `/lamp/`.

## Contract

Only `https://vh.do` and `https://www.vh.do` browser origins are accepted. Send JSON with `email` and `consent: true`. Optional `price` is empty, `under-50`, `50-100`, `100-200` or `over-200` (USD research bands). Optional `size` is empty, `small`, `medium` or `large` (bedside, desk/shelf or living-room placement). `company` is the hidden honeypot.

Success is HTTP 200 with `{"ok":true}`. All replies are `no-store`. Invalid input returns 400, an oversized body 413, wrong content type 415, and excessive requests 429 with Retry-After. Temporary storage or capacity failures return 503. The browser confirms success only after reading `ok: true` and offers an idempotent retry after errors or a 15-second timeout. Local previews never send details.

D1 enforces one active record per normalized email. Duplicate submissions return the same generic success without exposing membership, overwriting preferences or extending retention. This form does not verify mailbox ownership. Treat records as unverified interest; verify the address before using it for an email campaign. Do not promise inventory or order priority.

## Storage and abuse controls

The separate `vh-lamp-interest` database stores email, optional preferences, consent version and signup/expiry timestamps. No IP address, location, arbitrary source field or browser history is saved in it. Parameterized queries are used throughout. The native rate limiter sees a SHA-256 hash of the connecting IP and allows approximately 30 attempts per minute per Cloudflare location. Shared IPs can share this limit. Origins and the honeypot are additional checks, not authentication or complete bot protection.

An atomic database check caps new records at 1,000 in a rolling 24 hours across locations. This is a capacity safeguard, not a guarantee against all abuse or provider charges. Review service capacity before a large campaign. Provider free-plan quotas still apply.

Each record expires after 365 days. Exports exclude expired records immediately. A daily 04:17 UTC cron removes them. D1 recovery history can retain deleted records for up to 30 additional days. After a recovery, honor deletion requests again and run expiry cleanup before exporting. Do not create indefinite copies of contact lists.

## Deploy

Use Node.js 22.13 or newer for the repository tests, and Wrangler 4.36 or newer. The checked-in config identifies the existing Worker and dedicated D1 database; its IDs are not secrets. For a different account, create a separate database and replace those IDs. Do not bind this service to another application's database.

```sh
npm test
npx wrangler d1 migrations apply vh-lamp-interest --remote --config workers/preorder/wrangler.toml
npx wrangler deploy --config workers/preorder/wrangler.toml --experimental-provision=false
npx wrangler secret put ADMIN_TOKEN --config workers/preorder/wrangler.toml
```

Use a random admin secret of at least 32 characters. Store it in a secret manager; never commit it, put it in a URL, or expose it in frontend code. Worker observability is disabled to avoid application request logs. Cloudflare still processes operational network information.

The service is `https://vh-preorder.vh-do.workers.dev`. `GET /health` returns only the service name and health response, not database contents. Verify CORS preflight, submission, authorized export and test-record erasure before publishing the form.

## Administration

Supply `Authorization: Bearer <ADMIN_TOKEN>` from a trusted admin tool, never a public browser page.

- `GET /export` returns a CSV page of up to 500 active records. If `X-Next-Cursor` is present, request `/export?after=<cursor>` and repeat until it is absent. Concatenate rows without repeating the header. Formula-like cells are prefixed with an apostrophe for spreadsheet safety. Timestamps are Unix seconds in UTC.
- `DELETE /preorder` with JSON `{"email":"person@example.com"}` erases that record. The email goes in the request body, never the URL. This is idempotent. Verify the requester controls the address before erasure or changes.

For a correction, verify the address, export its current consent details privately, erase the old record and ask the person to join again. Any mailing workflow must preserve the consent purpose and provide an effective unsubscribe method. Apply unsubscribe/deletion requests before the next send. This repository does not include a campaign sender.

## Verification

`npm test` includes the production SQL executed against SQLite through a minimal D1 adapter. It covers malformed and oversized bodies, consent, origins, native rate-limit results, duplicates, capacity, retention, admin authorization, CSV escaping, pagination, deletion and storage failures. Client transport tests use a real local HTTP server. Also inspect the live mobile menu, keyboard dialog controls, validation and success/error feedback.

Cloudflare references: [rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [D1 locations](https://developers.cloudflare.com/d1/configuration/data-location/), [recovery history](https://developers.cloudflare.com/d1/reference/time-travel/).
