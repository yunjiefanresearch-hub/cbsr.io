# CBSR — landing page, mapper, and the offline demo

Three folders. Two of them are repositories you push to GitHub; the third is a build
output you send to people.

| folder | what it is | where it goes |
|---|---|---|
| `cbsr.io/` | the landing page | its own repo → GitHub Pages |
| `cbsr-mapper/` | the interactive mapper | its own repo → GitHub Pages |
| `demo/` | prebuilt offline demo | not a repo — attach to a release, or just send the file |

They stay separate on purpose. The mapper carries its own version, its own CHANGELOG,
and its own CI gate over the register invariants; folding it into the landing page would
mean one deploy could not fail without taking the other down with it. The landing page
embeds the deployed mapper in an iframe, and if that embed does not come up the page
falls back to a corridor picker that reads the same data — so a broken mapper deploy
degrades the landing page rather than breaking it.

The register itself lives in a third repository,
`cross-border-stablecoin-register`, and is not included here.

## Push order, first time

The landing page points an iframe at the mapper's Pages URL, so deploy the mapper first
and the embed is live the moment the landing page goes up.

```bash
# 1. the mapper
cd cbsr-mapper
git init && git add -A && git commit -m "CBSR mapper v0.11.1"
git remote add origin git@github.com:<you>/cbsr-mapper.git
git push -u origin main
# then: Settings → Pages → Source: GitHub Actions

# 2. the landing page
cd ../cbsr.io
git init && git add -A && git commit -m "CBSR landing page"
git remote add origin git@github.com:<you>/cbsr.io.git
git push -u origin main
# then: Settings → Pages → Source: GitHub Actions
```

Both workflows are already committed under `.github/workflows/`. Neither needs a secret,
a token, or a `package-lock.json`.

**If your mapper repo is not named `cbsr-mapper`**, or it is on a different account, edit
one line in `cbsr.io/index.html`:

```js
var MAPPER_URL = "https://<you>.github.io/cbsr-mapper/";
```

Nothing else references it.

## What each pipeline checks before it deploys

Both fail the deploy rather than shipping something broken — that is the point of them.

**`cbsr-mapper`** runs the register invariants *before* the build (a violated invariant
should stop a deploy, not be discovered inside one), then again against `dist/` after
bundling: record and citable counts match the data, all 66 jurisdiction pairs and 132
directed corridors are present, the corridor evidence contract holds with no half-states
and nothing citable-while-pending, and no placeholder text survives into production.

**`cbsr.io`** stamps the real Pages URL into `og:url`, `og:image` and `canonical` —
crawlers do not run JavaScript, so those cannot be filled in at runtime — then fails if
any placeholder survived, if the card or favicon is missing, or if the analysis index
links to a PDF that is not in the repo.

## Rebuilding the demo

The demo is the only cross-repo build, which is why it is a folder here rather than a
workflow in either repo.

```bash
cd cbsr-mapper
npm install
npm run build:offline                    # → dist-offline/mapper.html

cd ..
node cbsr.io/tools/build-demo.mjs \
     cbsr.io cbsr-mapper/dist-offline/mapper.html demo            # two files
node cbsr.io/tools/build-demo.mjs \
     cbsr.io cbsr-mapper/dist-offline/mapper.html demo --inline   # one file
```

`npm run build:offline` is not the real build. `npm run build` (Vite) still is, and it is
what Pages deploys. The offline builder exists because a demo laptop should not depend on
a package registry or a network: it transpiles the JSX with TypeScript and inlines React
from `node_modules` into a single classic `<script>`. That is also why the output opens
from `file://` — an ES-module build cannot.

## Tests

Both repos carry the same browser suites under `tools/` (in `cbsr.io`) and `scripts/`
(in `cbsr-mapper`). They drive real Chromium via Playwright, which is not a dependency of
either package — install it when you want to run them:

```bash
npm i -D playwright && npx playwright install chromium

node cbsr.io/tools/test-landing.mjs cbsr.io/index.html   # 14 checks
node demo/tools/test-mapper.mjs     demo/mapper.html     # 21 checks
node demo/tools/test-demo.mjs                            # 10 — two-file demo
node demo/tools/test-demo-inline.mjs                     # 10 — merged single file
```

What they are actually guarding: that the corridor picker and the timeline still compute
from the register rather than from a hand-typed table; that switching to Chinese leaves
no untranslated block; that the map area is never an empty box, whether or not the mapper
loads; that the offline build makes no network request at all; and that no proxy, CORS or
Worker wording can reach the screen.

## Licence

Data CC-BY-4.0, code Apache-2.0. No warranty — verify against primary law.
