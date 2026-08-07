# CBSR — offline demo package

Double-click **`cbsr-demo.html`**. That is the whole procedure.

No server, no build step, no network. Pull the cable out and it still works. Tested
with every non-`file://` request blocked at the browser.

## What is in here

Two shapes of the same demo. Use whichever suits how you are sending it.

| file | what it is |
|---|---|
| **`cbsr-demo.html`** | **everything in one file** — landing page with the mapper inlined. One attachment, nothing to keep together. 1.4 MB. |
| `index.html` + `mapper.html` | the same demo as two files, the mapper loaded from beside the page. Marginally lighter; keep them in the same folder. |
| `favicon.svg`, `og-card.png` | assets the two-file version references (the merged file needs neither) |
| `papers/` | the analysis PDFs the publication index links to (two-file version only) |
| `tools/` | the scripts that generated this folder, and the tests that check it |

The merged file carries the mapper in an iframe `srcdoc` rather than pasting it into the
page. That is deliberate: the mapper ships its own stylesheet with selectors — `.wrap`,
`.nav`, `.run` — that the landing page also uses, and an iframe is a document boundary
those cannot cross. It is why the merged file behaves identically to the two-file version
rather than approximately.

The embed is live: the mapper inside the page is the real thing, not a screenshot.
Language switches propagate both ways — the toggle in the page header drives the
iframe, and the toggle inside the iframe drives the page.

One caveat on the merged file: 900 KB of analysis PDFs cannot be inlined and still leave
one file, so in `cbsr-demo.html` those links point at the live site and need a network.
Everything the demo is actually *for* — the map, the register, every view — is offline.

## Positioning

The page is written as open infrastructure, not as a product: open data, open code, no
rate card, and a publication index rather than a product tour. The former pricing block is replaced by three sections — how to use it, what
you may rely on (the snapshot contract: versioned, dated, no uptime or freshness
undertaking), and how it is sustained (independent, unfunded, and what contributions
actually help).

## What is different from the deployed sites

Two things, both deliberate, both reversible.

**The mapper runs in `DEMO_MODE`.** Three features need an authenticated model
proxy: document/URL import, the auto-map router, and question generation. Without
one, they fail at the CORS preflight and the app correctly shows a diagnostic banner
and a proxy-configuration field — which is not what should be on screen during a
presentation. `DEMO_MODE` removes those surfaces by removing their cause: it does
not hide a failing call, it stops making the call.

- Routing is done by a deterministic keyword rule over the same six business-feature
  flags the manual checkboxes set. The restatement says so on screen, and the manual
  checkboxes are still there to correct it.
- Questions are composed from each record's own fields — authority, pinpoint, source,
  tension, resolution channel, binding status — so every question points at something
  the register actually holds. Labelled as such.
- Everything else was already deterministic and is untouched: the dimension map,
  corridors, the 12×12 matrix, time-travel, the constraint substrate, the machine
  surface, and every export.

To restore the AI paths once a proxy is deployed, set `window.__CBSR_DEMO__ = false`
before the bundle loads, or flip `DEMO_MODE` at the top of `src/App.jsx`. None of the
AI code was deleted.

**The webfont is not loaded.** IBM Plex is fetched from Google Fonts on the deployed
sites. Offline that request hangs, fails, and reflows the type mid-demo, so the demo
build ships the fallback stack the CSS already declared. Slightly different letterforms,
identical layout.

## Regenerating this folder

```bash
# 1. the mapper, as one self-contained file
cd cbsr-mapper
npm install
npm run build:offline          # -> dist-offline/mapper.html

# 2. the demo folder — two files
cd ..
node cbsr-landing/tools/build-demo.mjs \
     cbsr-landing cbsr-mapper/dist-offline/mapper.html demo

# 3. and the merged single file
node cbsr-landing/tools/build-demo.mjs \
     cbsr-landing cbsr-mapper/dist-offline/mapper.html demo --inline
```

`build:offline` is not the real build. `npm run build` (Vite) still is, and it is what
GitHub Pages deploys. The offline builder exists because a demo laptop should not
depend on a package registry or a network: it transpiles the JSX with TypeScript and
inlines React from `node_modules` into a single classic `<script>`, which is also why
the output opens from `file://` — an ES-module build cannot.

## Tests

The three suites under `tools/` drive a real browser (Playwright, Chromium):

```bash
npx playwright install chromium     # once
node tools/test-landing.mjs ../cbsr-landing/index.html
node tools/test-mapper.mjs  mapper.html
node tools/test-demo.mjs                    # the two-file demo
node tools/test-demo-inline.mjs             # the merged single file
```

`test-landing` checks the corridor picker and timeline still compute from the register,
that no untranslated block survives a switch to Chinese, and that a page whose mapper
is unreachable falls back to the working preview instead of a blank rectangle.
`test-mapper` checks the map flow runs end to end with every off-machine request
blocked, and that no proxy/CORS/Worker wording reaches the screen. `test-demo` runs
both together and asserts zero network requests for the whole page.
