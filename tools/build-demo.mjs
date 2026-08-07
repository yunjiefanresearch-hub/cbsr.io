#!/usr/bin/env node
/**
 * Assembles the offline demo folder.
 *
 * The deployed setup is two sites: the landing page on one host, the mapper on another,
 * stitched with an iframe. A demo laptop has neither. This produces the same two pages
 * side by side on disk, pointed at each other, with every remote dependency removed:
 *
 *   demo/index.html   the landing page, iframe pointed at ./mapper.html
 *   demo/mapper.html  the whole mapper in one self-contained file
 *
 * Nothing here edits the deployable sources. The demo is a derived artifact; the repos
 * still deploy exactly as before.
 */

import fs from "node:fs";
import path from "node:path";

// Usage: node build-demo.mjs <landing-dir> <mapper.html> <out-dir>
const LANDING = process.argv[2] || "landing/cbsr-landing";
const MAPPER = process.argv[3] || "";
const OUT = process.argv[4] || "demo";
// --inline collapses the landing page and the mapper into one double-clickable file.
const INLINE = process.argv.includes("--inline");

let html = fs.readFileSync(path.join(LANDING, "index.html"), "utf8");
const before = html;

// 1 ── point the embed at the local mapper instead of the deployed one
html = html.replace(
  /var MAPPER_URL = "[^"]*";/,
  'var MAPPER_URL = "./mapper.html";   // OFFLINE DEMO: the mapper sits next to this file'
);
if (html === before) throw new Error("MAPPER_URL line not found — did the landing page change?");

// 2 ── drop the webfont, which is the page's only remaining network request. The CSS
//      already declares a full fallback stack, so this changes weight, not layout.
html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, "");
html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, "");

// 3 ── a demo copy must never be indexed if it is ever put on a host by accident
html = html.replace(/<link rel="canonical"[^>]*>/, '<meta name="robots" content="noindex">');

fs.mkdirSync(OUT, { recursive: true });

// 4 ── the hosted analysis PDFs
// The two-file demo keeps them beside the page and they open offline. The merged single
// file cannot carry 900 KB of binaries and still be one file, so its links are rewritten
// to the canonical site instead: they open with a network, and the demo's own subject —
// the map — remains fully offline either way.
const SITE = "https://yunjiefanresearch-hub.github.io/cbsr.io/";
if (INLINE) {
  html = html.replace(/href="(papers\/[^"]+)"/g, (_m, rel) => `href="${SITE}${rel}"`);
} else if (fs.existsSync(path.join(LANDING, "papers"))) {
  fs.mkdirSync(path.join(OUT, "papers"), { recursive: true });
  for (const f of fs.readdirSync(path.join(LANDING, "papers"))) {
    fs.copyFileSync(path.join(LANDING, "papers", f), path.join(OUT, "papers", f));
  }
}


if (!INLINE) fs.writeFileSync(path.join(OUT, "index.html"), html);

// 5 ── the mapper build, if one was handed to us
//
// Two shapes come out of the same source. The DEPLOYED site keeps the iframe pointed at the
// real mapper on its own origin: that is a separately versioned artifact and inlining a frozen
// copy of it into the landing page would guarantee the two drift apart. The DEMO is the
// opposite case — one machine, no network, nothing to drift against — so there the mapper is
// inlined and the whole thing collapses to a single double-clickable file.
//
// The inlining vehicle is `srcdoc`, not a <script> block holding the markup: the mapper is a
// complete HTML document with its own <script> tags, and the HTML parser ends a script block at
// the first `</script` in the byte stream regardless of what it is nested in. srcdoc takes an
// attribute-escaped document, which has no such hazard.
//
// It is also not inlined into the page's own DOM. The mapper ships ~1,200 lines of CSS with
// selectors like `.wrap`, `.nav`, `.run` — every one of which the landing page also uses. An
// iframe is a document boundary, so the two stylesheets cannot see each other. That boundary is
// the reason the merged file behaves identically to the two-file version.
if (MAPPER) {
  if (!fs.existsSync(MAPPER)) {
    console.error(`\n  ${MAPPER} not found — run \`npm run build:offline\` in the mapper repo first.\n`);
    process.exit(1);
  }
  if (INLINE) {
    const mapper = fs.readFileSync(MAPPER, "utf8");
    const esc = mapper
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    // Replace the src-driven frame with a self-contained one. MAPPER_URL is emptied so the
    // page's own loader leaves the frame alone; the reveal still waits for `cbsr-ready`, so a
    // frame that somehow fails to mount still falls back to the built-in preview.
    html = html.replace(
      /var MAPPER_URL = "[^"]*";[^\n]*/,
      'var MAPPER_URL = "";   // OFFLINE DEMO: the mapper is inlined in the iframe below'
    );
    // A FUNCTION replacer, never a string. In a string replacement `$\`` and `$'` are
    // substitution patterns meaning "everything before / after the match" — and a React bundle
    // contains both sequences in its source. Splicing the document in as a string therefore
    // re-inserted the whole page into itself, once per occurrence: the first attempt produced
    // 24 nested copies of the iframe. A function replacer receives the text verbatim.
    html = html.replace(
      /<iframe id="mapframe"([^>]*)><\/iframe>/,
      (_m, attrs) => `<iframe id="mapframe"${attrs} srcdoc="${esc}"></iframe>`
    );
    if (!html.includes("srcdoc=")) throw new Error("iframe not found — did the landing page change?");
    fs.writeFileSync(path.join(OUT, "cbsr-demo.html"), html);
    const kb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
    console.log(`  built ${OUT}/cbsr-demo.html  (${kb} MB, single file, landing + mapper)`);
  } else {
    fs.copyFileSync(MAPPER, path.join(OUT, "mapper.html"));
  }
}

// 6 ── the two static assets the page references by filename
for (const f of ["favicon.svg", "og-card.png"]) {
  const src = path.join(LANDING, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
}

// Only load-time references count: strip comments (a commented-out beacon is the
// documented off state, not a request) and outbound links the reader has to click.
const live = html.replace(/<!--[\s\S]*?-->/g, "");
// Only what the browser fetches on load counts: script/iframe/img src, and stylesheet
// links. An <a href> to SSRN or sec.gov is a link the reader clicks, not a dependency.
const remote = [
  ...live.matchAll(/\bsrc=["'](https?:\/\/[^"']+)/g),
  ...live.matchAll(/<link[^>]+href=["'](https?:\/\/[^"']+)/g),
  ...live.matchAll(/@import\s+url\(["']?(https?:\/\/[^"')]+)/g),
].map((m) => m[1]);
if (!INLINE) console.log(`  built ${OUT}/index.html`);
console.log(`  remaining load-time remote refs: ${remote.length ? remote.join(", ") : "none"}`);
