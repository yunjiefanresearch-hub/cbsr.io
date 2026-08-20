[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/14172/badge)](https://www.bestpractices.dev/projects/14172)

# CBSR — cbsr.io

The front door for the [Cross-Border Stablecoin Register](https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register):
the corridor map, the agent-grounding contract, the KYA framework, the intelligence stack,
the papers, the SDG mapping, and an open call for jurisdiction maintainers.

The site is positioned as **the evidence layer for agentic finance** rather than as a
stablecoin database. The name, the repository slug and the DOI do not change — they are
citation handles and breaking them costs more than any repositioning gains. What changes is
the order of the argument: agents that act come first, cross-border stablecoins are stated
as the first vertical, and `index.html#scope` says plainly which adjacent domains the method
would extend to and that none of them exists yet.

A plain static site. No build step, no dependencies, no framework. The `.html` files at the
root are the source — open one and you are reading exactly what ships.

```
index.html        home — the argument, the pipeline, the proof, the six surfaces, scope
corridors.html    the corridor layer: live map, six classes, the dated transitions
agents.html       MCP, the grounding contract, the four failures it prevents
kya.html          Know Your Agent — a working framework, published for comment
method.html       the intelligence stack, the six build layers, the gates in CI
research.html     six working papers and the dated analysis index
standards.html    rules-as-code / RegTech placement, and the SDG mapping
maintain.html     the maintainer role and the application form
thanks.html       where the form lands (noindex)
about.html        who made it, how it is sustained, how to cite it
404.html          the not-found page (noindex)

assets/cbsr.css   one stylesheet for every page
assets/cbsr.js    one script for every page; each block is guarded on its own markup
papers/           the short-form analysis PDFs the index links to
og-card.png       social preview card (1200×630)
favicon.svg       the site mark
sitemap.xml       stamped at deploy
robots.txt        stamped at deploy
.nojekyll         tells Pages not to run Jekyll over a plain static site
tools/            test suite and the shell-sync helper — not deployed content
```

## Deploy

1. Push this folder to a repo.
   - For the shortest URL, name it **`yunjiefanresearch-hub.github.io`**; it then serves at
     `https://yunjiefanresearch-hub.github.io/`.
   - Any other name works: it serves at `https://yunjiefanresearch-hub.github.io/<repo>/`.
2. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main`. The included workflow builds and publishes.

Nothing needs configuring. The workflow reads the real Pages URL from
`actions/configure-pages` and stamps it into `og:url`, `<link rel="canonical">`, the social
card, `sitemap.xml`, `robots.txt`, and the application form's redirect target. If the stamp
fails, or an internal link points at a file that is not in the repo, or the form has lost
one of its required fields, **the build fails rather than shipping a broken page**.

Deploying somewhere other than GitHub Pages? Replace the placeholder by hand first, keeping
the trailing slash:

```bash
sed -i 's|__SITE_URL__|https://your.url/|g' *.html sitemap.xml robots.txt
```

## The maintainer application form

`maintain.html` carries the application. It posts to a form relay, which delivers to
`yunjiefan.research@gmail.com` without this repo running a server.

**Before it works, the relay has to be activated.** The first time the form is submitted,
FormSubmit sends a confirmation email to that address with an activation link. Until that
link is clicked, submissions are accepted by the relay and never delivered. So: deploy,
submit the form once yourself, click the link in the email, then submit once more to check
it arrives and lands on `thanks.html`.

Two things worth knowing about how it is built:

- **The honeypot** is a field named for a plausible target (`_honey`) and positioned
  off-canvas. A person never sees it; a bot fills every field it finds. A submission that
  fills it is dropped client-side and never posted.
- **The fallback** is not an error message. If the relay is unreachable, or the applicant
  would simply rather not use it, the link beside the button composes the same application
  as an email — field labels, answers and all — so nobody is ever left with a completed
  form and nowhere to send it.

To swap relays, change `FORM_ENDPOINT` near the bottom of `assets/cbsr.js` and the
`action` on the form in `maintain.html`. Setting `FORM_ENDPOINT` to an empty string turns
the whole form into the email path, which is a reasonable posture if you would rather no
third party saw applications at all. FormSubmit also issues a random-string endpoint that
delivers to the same inbox without the address appearing in the HTML; if scraping becomes a
problem, that is the switch to make.

## Bilingual text

English is whatever is in the markup. Chinese lives on the element it belongs to:

```html
<p data-zh="中文">English</p>
<input data-zh-placeholder="中文" placeholder="English">
```

The script caches the English on first paint, so a missing `data-zh` degrades to English
rather than to an empty box. Two caches are kept — one for `innerHTML`, one for attributes
— because mixing them produced a class of bug where a translated placeholder overwrote a
translated label.

Titles of published work are deliberately **not** translated, in either language. A title
is a citation handle; it is how a piece is found on SSRN, on sec.gov, and in a footnote,
and a translated one retrieves nothing. The standfirsts carry the meaning instead.

## The embedded map

`corridors.html` embeds the interactive corridor map from
`https://yunjiefanresearch-hub.github.io/cbsr-mapper/`, set as `MAPPER_URL` at the top of
`assets/cbsr.js`.

Language is synced both ways. The page passes its language to the map on the iframe URL,
the map announces itself when it mounts, and the page answers with the authoritative
choice, so the two never sit in different languages.

That sync needs the map's own deploy to be current. A build of the map that predates it
ignores the language and opens in its own default, which reads as the page being in one
language and the map in another. If you see that, redeploy the map.

The embed is only revealed once the map posts `cbsr-ready`, which is the one signal that it
actually mounted. Until then — and forever, if the map is not deployed, is stale, or 404s —
the page keeps its built-in corridor picker, which reads the same corridor layer. The worst
case is a smaller demo, never an empty rectangle where the product should be.

## Keeping the ten pages in step

The navigation appears on every page, which is the price of having no build step. Rather
than pay it ten times by hand:

```bash
python3 tools/sync-shell.py          # copy index.html's header and footer to every page
python3 tools/sync-shell.py --check  # report drift, exit 1 — suitable for CI
```

It touches the `<header class="top">…</header>` and `<footer>…</footer>` blocks and nothing
else.

## Tests

`tools/` carries a browser suite that drives real Chromium. Playwright is not a dependency
of this repo; install it when you want to run them.

```bash
npm i -D playwright && npx playwright install chromium
node tools/test-site.mjs .
```

It checks that every page loads with the shared shell and marks itself in the navigation,
that switching to Chinese leaves no untranslated block on any page, that the corridor
picker and the date control still compute from the register rather than a typed table (US→EU
reads Category I, EU→US reads Category T today and Category II once §18 has commenced), that
the analysis index is reverse-chronological and its filter works, that the application form
keeps its relay, its honeypot, its required fields and its email fallback, that no internal
link points at a missing file, and that the map area is never an empty box.

The suite runs against the **unstamped** files, because that is the state a contributor
opens locally, and the runtime URL fallback has to hold there.

## License

Page and assets: CC-BY-4.0, consistent with the register's data license.
Register data: CC-BY-4.0. Register code: Apache-2.0.
