# Building and publishing cbsr.site

The browser receives static HTML. Python 3.10+ builds the publication with standard-library
modules only; Node.js runs the existing Register and policy-material checks. No production
package installation or browser framework is required.

## Local build and preview

```sh
python3 tools/build_search_site.py --base-url https://cbsr.site/ --output _site
python3 tools/search_site_test.py --site-dir _site --base-url https://cbsr.site/
python3 -m http.server 8080 --directory _site
```

Use `python` on Windows if that is the installed interpreter command. Open
`http://localhost:8080/`, `/zh/`, `/data/` and `/zh/jurisdictions/`. Serve the generated
directory over HTTP; source files do not preview the published routes.

For a project-path deployment, pass the full base URL, for example
`https://example.github.io/cbsr.io/`. All public metadata and local resource links use that
prefix. Serve the output under the same prefix when testing in a browser.

## Sources and evidence dates

- Root `.html` files are the editorial source. Their `data-zh` translations are rendered
  into separate Chinese pages during the build. Published language selection uses links.
- `tools/search_pages.py` renders the dataset, jurisdiction, corridor and research pages.
- `content/search/` contains the public snapshot and its provenance manifest.
  Only explicitly selected public downloads are copied to `assets/search/` in the output.
- Root source, tools, tests, private receipts, Git metadata, and internal documentation
  are excluded from the publication.
- A page modification date is not the dataset snapshot date or a legal review date.

After changing shared navigation, run `python3 tools/sync-shell.py`. After changing source
content, rebuild; do not edit `_site/` directly.

## Runtime metadata

The existing binder reads the public Register API for matching metadata and review tasks:

`https://yunjiefanresearch-hub.github.io/cross-border-stablecoin-register/api`

Published pages declare their snapshot version and date. If the API is unavailable,
incomplete, or describes a different release, the page retains its build-time figures and
states that the metadata is unavailable. It does not silently relabel historical evidence
with a newer version. Updating the legal dataset requires an explicit snapshot update.

Do not add inline configuration scripts: the site has a restrictive Content-Security-Policy.
If an API origin changes, update the reviewed script and CSP together.

## GitHub Pages

Choose **Settings > Pages > Build and deployment > GitHub Actions**. The workflow:

1. Checks the website against the immutable Register revision and policy-material tests.
2. Builds English, Chinese and evidence pages for the configured Pages URL.
3. Validates canonical/language metadata, structured data, sitemap and internal links.
4. Uploads only `_site/` and deploys that artifact.

A pull request runs the same build checks without publishing. Watch the actual Pages
deployment result after merging; a local build alone does not confirm deployment.

## Search account actions

Search Console ownership, Bing verification, sitemap submission, AI inclusion controls,
and third-party profile fields require the corresponding account access. Follow
[SEO_GEO_OPERATIONS.md](docs/SEO_GEO_OPERATIONS.md); a successful deployment is not a
search-index or AI-citation guarantee.
