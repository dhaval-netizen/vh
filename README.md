# v/h

The v/h company website, published with GitHub Pages at https://vh.do.

## Files

- `index.html` contains the home page.
- `philosophy.html` contains the founder's article.
- `styles.css` and `brand.css` contain the styles.
- `site.js` controls the navigation and interactive diagrams.
- `navigation.mjs` handles clean section URLs and older bookmarks.
- `routes.mjs` defines the home and philosophy section paths.
- `content/journal/posts.json` contains the public journal content.
- `journal.css` adds journal layouts to the existing Philosophy styles.
- `scripts/sync-linkedin.mjs` imports verified LinkedIn posts and their media.
- `scripts/build-journal.mjs` generates the journal, RSS feed, and sitemap.
- `assets/` contains the images, favicon, and Neue Montreal font files.

The site uses plain HTML, CSS, and JavaScript with no package dependencies. Run `npm run build` after editing either source HTML page or the route map, then run `npm test`. The build generates directory entry pages for clean URLs such as `/idea/`, `/philosophy/`, and `/philosophy/owning-it/`. Commit those generated pages with the source changes so direct visits and refreshes work on GitHub Pages.

The generated pages contain a comment identifying their source. Edit `index.html` or `philosophy.html` instead of editing generated copies. The old `philosophy.html` page remains available for existing bookmarks and updates its address to `/philosophy/` when JavaScript runs.

## Journal publishing

The journal lives at `/journal/`. Every post has a permanent `/journal/<ledger-key>/` URL. Article pages use the Philosophy page's fonts and reading layout. Original copy, images, films, documents, and LinkedIn source links are preserved. Hashtag-only paragraphs are retained in the content manifest but omitted from the article layout.

After verifying a company post on LinkedIn and recording it in the private publication ledger, run:

```sh
npm run sync:linkedin
npm run build
npm test
```

The importer defaults to `../../linkedin-posts/published.json` and `../../../outputs/linkedin-launch` relative to this repository. For another checkout, pass `--ledger /path/to/published.json --asset-root /path/to/media` after `npm run sync:linkedin --`. Absolute attachment paths in the ledger are also supported. Node.js and Poppler's `pdftoppm` and `pdftotext` must be available. The build and tests themselves do not need the private ledger or Poppler.

Only entries with `verified: true` and a published status (or no legacy status field) are imported. Titles, full copy, publication dates, public source links, and media are explicitly selected; private notes, analytics, proof screenshots, and local paths are not copied into the manifest. A missing attachment or duplicate key/source stops the import before replacing the manifest. Posts without a precise timestamp may use a verified `localDate`; other dates use America/Los_Angeles.

Review the changes, inspect new media in a local preview, commit the content and generated pages, and push to `main`. Confirm the GitHub Pages deployment and the public article before recording its website URL and commit in the private ledger. Rerunning the importer is safe and keeps the same URLs. If the website step fails after LinkedIn publication, repair the website without reposting to LinkedIn.

The daily automation must also reconcile the journal when today's LinkedIn post already exists. Before importing, check the live company feed for any public posts added outside the automation and add verified entries to the ledger. Do not copy drafts or remove older verified entries from the ledger.

## Preview

Run `python3 -m http.server 8000` from this directory and open http://localhost:8000.

## Publishing

GitHub Pages publishes the root of the `main` branch. Push changes to `main` to update the site. The `.nojekyll` file tells GitHub to serve the files directly. The custom domain is `vh.do`, and `www.vh.do` redirects to it once DNS and HTTPS are active.

## Fonts and assets

The site includes the existing Neue Montreal Regular, Medium, and Bold files. They are third-party demo/trial copies from Pangram Pangram. Their inclusion does not grant a commercial web licence. See `assets/neue-montreal-trial-license.txt` and the [foundry's licensing information](https://pangrampangram.com/products/neue-montreal).

The v/h name, logo, copy, and images remain subject to their owners' rights. This repository does not grant an open-source licence for those materials or the fonts.

## Lamp page and interest list

The lamp concept is at `/lamp/`, with a clean `/lamp/film/` section URL and `/privacy/` notice. Edit `preorder.html`, `preorder.css` and `preorder.js`, then run the normal build. `/preorder/` redirects to `/lamp/` for old links. The page describes development requirements, not a shipping product, and takes no orders or payments.

The signup service deploys separately from GitHub Pages. See [the Worker instructions](workers/preorder/README.md) and [release checks](docs/preorder-launch-checklist.md). Tests require Node.js 22.13 or newer. Team portraits in `assets/team/` are the current LinkedIn photos selected for publication by v/h, with profile links beside each biography.
