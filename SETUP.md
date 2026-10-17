# Repository setup

The official website is [cbsr.site](https://cbsr.site/). Keep the repository's existing Git
history, hidden workflow files, `.nojekyll`, and policy PDFs intact.

## Requirements

- Python 3.10+ for the standard-library publication builder.
- Node.js for the existing Register and policy-material checks.
- GitHub Pages configured to use **GitHub Actions**, not direct branch publication.

Follow [DEPLOY.md](DEPLOY.md) to build and preview `_site/`. There is no npm dependency
installation for the production site. Do not upload the repository root as a website:
language pages and evidence routes are created by the build.

## Maintainer form

`maintain.html` posts to FormSubmit for the published maintainer mailbox. Its relay must be
activated by the mailbox owner before delivery works. The owner should submit a clearly
identified test, complete the activation email if needed, then confirm receipt and the
thank-you redirect. Do not submit test applications to someone else's mailbox.

The mailto alternative remains available if the relay is unreachable. Form delivery is
separate from search indexing, and a successful submission does not imply acceptance of a
maintainer application.

## Search setup

Follow [the search operations guide](docs/SEO_GEO_OPERATIONS.md) to verify the domain in
Google Search Console and Bing Webmaster Tools, inspect core URLs, submit the sitemap,
and collect a baseline. Profile changes should point to the canonical website while
retaining distinct source-code, DOI, download, and issue-tracker URLs.

Do not publish private MiCA receipts, account credentials, or verification tokens from an
unrelated service in the repository. Add only domain verification material issued by
the intended service for this site if that method is selected by its owner.
