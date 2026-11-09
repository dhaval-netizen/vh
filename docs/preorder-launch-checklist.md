# Pre-order page launch checklist

Everything needed for vh.do/preorder/ to work and be safe to promote. Owners: Vedh for Cloudflare and code, the three founders for content sign-off.

## Must do before the page is shared

- [ ] Merge the team page PR first (this branch is built on top of it, for the Team link in the menu).
- [ ] Deploy the pre-order Worker: follow `workers/preorder/README.md`, steps 1 to 6. Without it, the form shows an error on vh.do.
- [ ] If the Worker URL differs from `https://vh-preorder.vh-do.workers.dev/preorder`, update `ENDPOINT` in `preorder.js` and run `npm run build`.
- [ ] Submit the live form from a phone and a laptop, and check both rows appear in the export.
- [ ] Confirm the privacy notice at /privacy/: controller name, contact email, 12-month retention.
- [ ] Update the home page FAQ. It still says "We haven't announced a product, a price, or a release date."
- [ ] Sign off the product claims on the page: the lamp is wired; it senses when you sit down and leave; an AI agent inside the lamp learns your routine; nothing goes to the cloud; no app, no account, no internet needed.

## Should do

- [ ] Add a rate limiting rule for `/preorder` (README step 7).
- [ ] Add a "Pre-order" link to the main menu and footer once the page is final. It is deliberately unlinked for now.
- [ ] Buy the Neue Montreal commercial licence. The site still uses trial fonts, which the repo's own licence note says need a licence before public launch.
- [ ] Decide what the button on the base does, and add one line about it to the "Everything it needs is in the base" caption.
- [ ] Replace the line-drawn lamp with real renders or prototype footage when available. Until then the page and the film stay labelled as a concept.

## How the page behaves

- **Intro:** a quick flash through the history of light, ending on a person sitting down and the lamp turning on. People who have turned off animation on their device see the final frame only.
- **Currency:** price options are shown in the visitor's local currency, from their time zone, then their browser language, falling back to USD. 11 currencies are supported. The stored band key is always in USD terms.
- **Form:** opens from any Pre-order button, including the one inside the video. It checks the email, price and size before sending. It sends nothing except on vh.do.
- **Film:** `assets/preorder/vh-lamp-film.mp4`, 48 seconds, rendered from `scripts/film/film.html`. See `scripts/film/README.md` to change and re-render it.
