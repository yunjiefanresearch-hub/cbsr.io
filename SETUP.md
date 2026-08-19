# Deploying this repo

## The one thing that goes wrong

This folder contains a hidden directory, `.github/`, which holds the deploy workflow.
**Finder and File Explorer do not show it**, so dragging the folder into GitHub's
"Add file → Upload files" box silently uploads everything *except* the workflow. The push
succeeds, the files look right, and no Action ever runs.

Two other hidden files matter too: `.nojekyll` (without it, Pages runs Jekyll over the site
and can drop files) and `.gitignore`.

Check with:

```bash
ls -a          # you should see .github, .gitignore and .nojekyll
```

## Push it (this uploads hidden files correctly)

```bash
cd cbsr.io
git init
git add -A
git commit -m "CBSR site"
git branch -M main
git remote add origin git@github.com:<you>/cbsr.io.git
git push -u origin main
```

Then: **Settings → Pages → Build and deployment → Source → GitHub Actions.**

Not "Deploy from a branch". With the wrong source the workflow still runs but fails at the
last step, which looks like a broken build rather than a setting.

## Replacing an existing deploy

This version splits what used to be one `index.html` into ten pages plus an `assets/`
directory. If you are pushing over the old repo, delete the old `index.html` from the
working tree first — otherwise git will merge the new one in cleanly but any stale file
that is no longer referenced stays deployed and indexed.

```bash
git rm -r --cached .          # forget the old tree
git add -A                    # stage the new one
git commit -m "Split the landing page into function pages"
```

Old inbound links to `index.html#research`, `#method` and so on still land on the home page
rather than 404, and `404.html` names the new locations for anything else.

## Turn on the application form

The maintainer form on `maintain.html` delivers through a relay, and **the relay is dormant
until it is activated once**:

1. Deploy.
2. Open `maintain.html` on the live site and submit the form yourself with anything.
3. Check `yunjiefan.research@gmail.com` for a confirmation email from FormSubmit and click
   the activation link in it.
4. Submit once more. It should arrive in the inbox, and the browser should land on
   `thanks.html`.

Until step 3, submissions are accepted and never delivered — which looks exactly like a
working form. Do not skip it.

If the relay is ever unreachable, the link beside the submit button composes the same
application as an email, so applicants are never stranded.

## Verify

- `https://github.com/<you>/cbsr.io/blob/main/.github/workflows/deploy.yml` opens (not 404)
- The **Actions** tab shows a green run
- Settings → Actions → General is set to "Allow all actions"
- Every page in the header navigation opens
- The language toggle switches the whole page, including the form labels

## If the Actions tab is empty and the file is there

The workflow triggers on `push` to **`main`**. If your default branch is `master`, either
rename the branch or change the branch name inside `.github/workflows/deploy.yml`.

## What the workflow does

Stamps the real Pages URL into `og:url`, `og:image`, `canonical`, `sitemap.xml`,
`robots.txt` and the form's redirect target — crawlers do not run JavaScript, and the relay
will not take a relative redirect — then fails the deploy if any placeholder survived, if a
page lost its stylesheet or script, if an internal link points at a file that is not in the
repo, if the analysis index links to a missing PDF, or if the form has lost its relay,
honeypot or redirect.

## After it is live

`corridors.html` embeds the mapper from `MAPPER_URL`, set at the top of `assets/cbsr.js`.
Deploy `cbsr-mapper` first, or that page shows its built-in corridor picker instead — which
works, and reads the same corridor layer, but is the smaller demo.
