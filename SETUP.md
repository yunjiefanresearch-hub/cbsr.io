# Deploying this repo

## The one thing that goes wrong

This folder contains a hidden directory, `.github/`, which holds the deploy workflow.
**Finder and File Explorer do not show it**, so dragging the folder into GitHub's
"Add file → Upload files" box silently uploads everything *except* the workflow. The push
succeeds, the files look right, and no Action ever runs.

Two other hidden files matter too: `.nojekyll` (without it, Pages runs Jekyll over the
site and can drop files) and `.gitignore`.

Check with:

```bash
ls -a          # you should see .github, .gitignore and .nojekyll
```

## Push it (this uploads hidden files correctly)

```bash
cd cbsr.io
git init
git add -A
git commit -m "CBSR landing page"
git branch -M main
git remote add origin git@github.com:<you>/cbsr.io.git
git push -u origin main
```

Then: **Settings → Pages → Build and deployment → Source → GitHub Actions.**

Not "Deploy from a branch". With the wrong source the workflow still runs but fails at
the last step, which looks like a broken build rather than a setting.

## If you must use the web uploader

Upload the visible files by dragging, then create the workflow by hand — the web editor
accepts a path with slashes and makes the directories for you:

1. **Add file → Create new file**
2. Name it exactly: `.github/workflows/deploy.yml`
3. Paste the contents of that file from this folder
4. Commit

Do the same for `.nojekyll` (an empty file).

## Verify

- `https://github.com/<you>/cbsr.io/blob/main/.github/workflows/deploy.yml` opens (not 404)
- The **Actions** tab shows a run
- Settings → Actions → General is set to "Allow all actions"

## If the Actions tab is empty and the file is there

The workflow triggers on `push` to **`main`**. If your default branch is `master`, either
rename the branch or change the branch name inside `.github/workflows/deploy.yml`.

## What the workflow does

Stamps the real Pages URL into `og:url`, `og:image` and `canonical` — crawlers do not run
JavaScript, so those cannot be filled in at runtime — then fails the deploy if any
placeholder survived, if the card or favicon is missing, or if the analysis index links to
a PDF that is not in `papers/`.

## After it is live

The page embeds the mapper from `MAPPER_URL`, set near the bottom of `index.html`. Deploy
`cbsr-mapper` first, or the page will simply show its built-in corridor picker instead of
the embed — which works, and reads the same register data, but is the smaller demo.
