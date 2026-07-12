# CBSR landing page

The front door for the [Cross-Border Stablecoin Register](https://github.com/yunjiefanresearch-hub/cross-border-stablecoin-register):
the thesis, the working papers, the live corridor map, and the DOI, on one page.

A plain static site. No build step, no dependencies, no framework. `index.html` is the whole
thing, plus two assets.

```
index.html      the page (bilingual EN / 中文, toggled in the header)
og-card.png     the social preview card (1200x630)
favicon.svg     the site mark
.nojekyll       tells GitHub Pages not to run Jekyll over a plain static site
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

## License

Page and assets: CC-BY-4.0, consistent with the register's data license.
