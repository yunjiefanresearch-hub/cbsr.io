[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/14172/badge)](https://www.bestpractices.dev/projects/14172)

# CBSR — cbsr.io

**Official website: [cbsr.site](https://cbsr.site/).**

The public front door for **CBSR**, backed by the
[Cross-Border Stablecoin Register](https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register):
the corridor map, the agent-grounding contract, the KYA framework, the intelligence stack,
the papers, bounded policy-participation records, the SDG mapping, and an open call for
jurisdiction maintainers.

The site introduces CBSR as **the evidence layer for agentic finance**, starting with
cross-border stablecoins. **CBSR is the product brand; Cross-Border Stablecoin Register
remains the formal dataset title used in citations.** The homepage presents the platform,
jurisdiction coverage, policy research, methods, and collaboration routes. Detailed source
and review information lives in the evidence library and methodology pages.

The visual identity uses a charcoal ground, silver type, restrained lavender accents,
and a local particle sculpture. `assets/cbsr-brand.css` extends the shared stylesheet on
every page; `assets/cbsr-field.js` runs only when its canvas is present. The animation
honors reduced motion and pauses offscreen. Fonts use local system stacks. No remote
video, font, canvas library, or animation dependency is required.

A static site with no browser framework or runtime package dependencies. Root `.html`
files are the editable bilingual source. A Python-standard-library build materializes
complete English and Chinese pages, evidence routes, canonical URLs, structured data,
and the sitemap before publication. Only the allowlisted `_site/` output is deployed.

```sh
python3 tools/build_search_site.py --base-url https://cbsr.site/ --output _site
python3 tools/search_site_test.py --site-dir _site --base-url https://cbsr.site/
python3 -m http.server 8080 --directory _site
```

On Windows, use `python` in place of `python3`. The build does not need network access.
See [DEPLOY.md](DEPLOY.md) and the [search operations guide](docs/SEO_GEO_OPERATIONS.md).

```
index.html        home — platform, coverage, policy research, methods, collaboration
corridors.html    the corridor layer: live map, six classes, the dated transitions
agents.html       MCP, the grounding contract, the four failures it prevents
kya.html          Know Your Agent — a working framework, published for comment
method.html       the intelligence stack, the six build layers, the gates in CI
research.html     policy-participation index, six working papers, dated analysis index
standards.html    rules-as-code / RegTech placement, and the SDG mapping
maintain.html     the maintainer role and the application form
thanks.html       where the form lands (noindex)
about.html        who made it, how it is sustained, how to cite it
404.html          the not-found page (noindex)

assets/cbsr.css       shared evidence components
assets/cbsr-brand.css shared dark identity and responsive homepage
assets/cbsr-field.js  local interactive particle sculpture
assets/cbsr.js        shared interaction script; each block is guarded on its own markup
assets/cbsr-live.js   binds published figures and the review worklist to Register API files
papers/           reviewed author PDFs and the short-form analyses the indexes link to
og-card.png       social preview card (1200×630)
favicon.svg       the site mark
sitemap.xml       legacy source; the publication build generates the current sitemap
robots.txt        crawl policy template; the build fills the public sitemap URL
.nojekyll         tells Pages not to run Jekyll over a plain static site
tools/            standard-library builder, content renderer, tests, shell sync — not deployed
content/search/   immutable public evidence snapshots and provenance — not deployed wholesale
_site/            generated publication; includes /zh/, /data/, /jurisdictions/, /corridors/, /research/
```

## Policy-participation materials

`index.html#policy-participation` is the single maintained source for the four full cards
and their evidence boundaries. `research.html#policy-participation-index` is deliberately a
compact source index rather than a second copy of those summaries.

Two reviewed author PDFs are hosted locally: the Treasury Part 1523 comment and *Eleven
Votes Short*. Their SHA-256 digests are pinned in `tools/policy-materials.test.mjs`, which
also checks the four-card count, dates, bilingual fields, public links, authorship
boundaries, original attachment terminology, and the absence of internal review metrics
from promotional copy. The snapshot contract separately verifies the underlying counts.

The SEC written-input card links the SEC-hosted 28-page original and distinguishes its
6 May 2026 author date from the 7 May listing date. Its summary describes the author's
proposal, not SEC policy or the SEC page's unreviewed AI-generated key points.

The MiCA response is not public. Do not add the private receipt, identifiers, editing URL,
email screenshot, or the downloaded questionnaire copy to the site. The public card links
only the European Commission consultation page and its public 45-page consultation
document. A receipt records delivery; it is not Commission endorsement or adoption.

## Deploy

1. In the `cbsr.io` repository, open **Settings → Pages → Build and deployment** and choose
   **GitHub Actions** as the source.
2. Push to `main`. The included workflow validates, builds, and publishes the site.

The workflow reads the real Pages URL from `actions/configure-pages`, verifies the pinned
Register contract and reviewed policy materials, builds `_site/`, validates the resulting
links and metadata, and uploads only that directory. Canonical URLs, language alternates,
social cards, sitemap and form redirects are resolved at build time. Existing English
URLs remain available; `/zh/` is a separate, fully rendered language tree.

Other static hosts should serve the generated `_site/` directory after the same checks.
Pass their actual public base URL to the builder; GitHub project paths are supported.
Do not publish the repository root or use a bulk placeholder replacement as a build substitute.

The evidence pages use a pinned, hashed snapshot, not an unsaved local Register checkout.
Page modification dates do not refresh the legal evidence. Review and update that snapshot
explicitly when advancing a release; keep the strict and structural candidate counts separate.

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

## Keeping the eleven pages in step

The navigation appears on every page, which is the price of having no build step. Rather
than pay it ten times by hand:

```bash
python3 tools/sync-shell.py          # copy index.html's header and footer to every page
python3 tools/sync-shell.py --check  # report drift, exit 1 — suitable for CI
```

It touches the `<header class="top">…</header>` and `<footer>…</footer>` blocks and nothing
else.

## Tests

The dependency-free contract check compares the website snapshot with a local checkout of
the exact Register revision used by deployment. It reads `api/meta.json`,
`api/worklist.json`, and `mcp.json`; checks count semantics and worklist structure; and then
checks that every published fallback and live binding agrees with those files.

```bash
node tools/check-register-contract.mjs ../cross-border-stablecoin-register
node --test tools/live-contract.test.mjs
node --test tools/policy-materials.test.mjs
```

CI pins the Register checkout to an immutable commit. When that pin advances, update the
`EXPECTED` snapshot in `tools/check-register-contract.mjs` and every affected HTML fallback
in the same change. This preserves a coherent page even when the live API cannot be reached.

`tools/` also carries a browser suite that drives real Chromium. Playwright is not a
dependency of this repo; install it when you want to run it.

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
link points at a missing file, that the policy-material cards remain bilingual and do not
embed private MiCA evidence, and that the map area is never an empty box.

The suite runs against the **unstamped** files, because that is the state a contributor
opens locally, and the runtime URL fallback has to hold there.

## License

Page and assets: CC-BY-4.0, consistent with the register's data license.
Register data: CC-BY-4.0. Register code: Apache-2.0.
