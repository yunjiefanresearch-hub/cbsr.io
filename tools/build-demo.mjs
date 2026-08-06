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
fs.writeFileSync(path.join(OUT, "index.html"), html);

// 4 ── the mapper build, if one was handed to us
if (MAPPER) {
  if (!fs.existsSync(MAPPER)) {
    console.error(`\n  ${MAPPER} not found — run \`npm run build:offline\` in the mapper repo first.\n`);
    process.exit(1);
  }
  fs.copyFileSync(MAPPER, path.join(OUT, "mapper.html"));
}

// 5 ── the two static assets the page references by filename
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
console.log(`  built ${OUT}/index.html`);
console.log(`  remaining load-time remote refs: ${remote.length ? remote.join(", ") : "none"}`);
