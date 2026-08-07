# CBSR landing page

The front door for the [Cross-Border Stablecoin Register](https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register):
the thesis, the working papers, the live corridor map, and the DOI, on one page.

A plain static site. No build step, no dependencies, no framework. `index.html` is the whole
thing, plus two assets.

```
index.html      the page (bilingual EN / 中文, toggled in the header)
papers/         the short-form analysis PDFs the publication index links to
og-card.png     the social preview card (1200x630)
favicon.svg     the site mark
.nojekyll       tells GitHub Pages not to run Jekyll over a plain static site
tools/          the demo builder and the browser test suite (not deployed content)
```

## Deploy

1. Push this folder to a new repo.
   - For the shortest URL, name it **`yunjiefanresearch-hub.github.io`**. It then serves at
     `https://yunjiefanresearch-hub.github.io/`, which is the right address for a front door.
   - Any other name works too: it serves at `https://yunjiefanresearch-hub.github.io/<repo>/`.
2. In the repo: **Settings > Pages > Build and deployment > Source > GitHub Actions**.
3. Push to `main`. The included workflow builds and publishes.

Nothing needs configuring. The workflow reads the real Pages URL from
`actions/configure-pages` and stamps it into `og:url`, `<link rel="canonical">`, and the
social card image, so those are correct on either kind of site. If the stamp fails, the
build fails rather than shipping a page with a broken canonical.

Deploying somewhere other than GitHub Pages (Netlify, Vercel, S3)? Replace the placeholder
by hand first, keeping the trailing slash:

```bash
sed -i 's|__SITE_URL__|https://your.url/|g' index.html
```

## The publication index

`papers/` holds the short-form analysis the index links to. The workflow checks every
`href="papers/…"` in `index.html` against the filesystem and fails the deploy if one is
missing, because a dead link on the page that is meant to *be* the evidence is worse than
no link. Adding a piece therefore means adding both the row and the file.

Titles are deliberately left in their original language in both EN and 中文. A title is a
citation handle — it is how the piece is found on SSRN, on sec.gov, and in a footnote —
and a translated one retrieves nothing. The standfirsts carry the meaning instead.

## The embedded map

The page embeds the interactive corridor map from
`https://yunjiefanresearch-hub.github.io/cbsr-mapper/`, set as `MAPPER_URL` near the bottom
of `index.html`.

Language is synced both ways. The page passes its language to the map on the iframe URL, the
map announces itself when it mounts, and the page answers with the authoritative choice, so
the two never sit in different languages. Toggling in either place moves both.

That sync needs the map's own deploy to be current. A build of the map that predates the
sync ignores the language entirely and opens in its own default, which reads as the page
being in one language and the map in another. If you see that, redeploy the map.

The embed is only revealed once the map posts `cbsr-ready`, which is the one signal that
it actually mounted. Until then — and forever, if the map is not deployed, is stale, or
404s — the page keeps the built-in corridor picker, which reads the same register data.
The worst case is a smaller demo, never an empty rectangle where the product should be.

## Tests

`tools/` carries a browser suite that drives real Chromium. Playwright is not a dependency
of this repo; install it when you want to run them.

```bash
npm i -D playwright && npx playwright install chromium
node tools/test-landing.mjs index.html
```

It checks that the corridor picker and the timeline still compute from the register rather
than a hand-typed table, that switching to Chinese leaves no untranslated block, that every
linked PDF resolves, that the analysis index is in reverse-chronological order, and that
the map area is never an empty box.

## License

Page and assets: CC-BY-4.0, consistent with the register's data license.
