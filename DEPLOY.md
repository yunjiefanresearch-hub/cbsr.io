# Deploying cbsr.io

Static site. No build step, no dependencies, no bundler.

## Local

    cd cbsr.io
    python3 -m http.server 8080
    # open http://localhost:8080

`file://` will not work: `assets/cbsr-live.js` fetches the register over
`fetch()`, and the Content-Security-Policy meta tag needs an http origin.

## Pointing at a register

Figures on every page are bound at run time from the register's `api/meta.json`.
By default the binder reads:

    https://yunjiefanresearch-hub.github.io/cross-border-stablecoin-register/api

To point somewhere else, add this before the `cbsr-live.js` tag on each page:

    <script>window.__CBSR_REGISTER_API__ = "https://.../api";</script>

If you change the origin, also update `connect-src` in the CSP meta tag,
otherwise the browser will block the fetch and every page will fall back to its
build-time figures (labelled as such — see below).

## What happens when the register is unreachable

The page marks itself `data-cbsr-live="offline"` and every `[data-live-stamp]`
element says "build-time snapshot — figures may be stale". The figures in the
markup are the fallback. A stale figure that says it is stale is acceptable; an
unlabelled wrong one is not, and that distinction is the reason this file exists.

## Verifying before you publish

    node tools/test-site.mjs

## Publishing

`.github/workflows/deploy.yml` publishes to GitHub Pages on push. `sync-shell.py`
propagates the shared header and footer across pages; run it after editing either.
