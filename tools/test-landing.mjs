import { chromium } from "playwright";   // npx playwright install chromium
import path from "node:path";
import fs from "node:fs";

const FILE = "file://" + path.resolve(process.argv[2] || "landing/cbsr-landing/index.html");
const CJK = /[\u3400-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;

const b = await chromium.launch();
const p = await b.newPage();
const consoleErrs = [];
const failedReqs = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
p.on("requestfailed", (r) => failedReqs.push(r.url()));

await p.goto(FILE);
await p.waitForTimeout(600);

const out = [];
const check = (name, ok, detail) => out.push({ name, ok, detail: detail || "" });

// 1 ── no unstamped placeholder left visible anywhere
const placeholders = await p.evaluate(() =>
  [...document.querySelectorAll("meta,link")]
    .map((e) => e.getAttribute("content") || e.getAttribute("href") || "")
    .filter((v) => v.includes("__SITE_URL__")).length);
check("no __SITE_URL__ placeholder survives", placeholders === 0, `${placeholders} left`);

// 2 ── the real invariant is not "the embed is hidden" — that only holds where the mapper
// is unreachable. It is that the visitor is NEVER shown an empty box: either the built-in
// preview is up, or the embed is up AND the frame actually mounted. Asserting the narrower
// version made the demo copy, where the mapper sits next to the page and correctly loads,
// look like a regression.
await p.waitForTimeout(1200);
const shown = await p.evaluate(() => ({
  embed: !document.getElementById("embed").hidden,
  preview: !document.getElementById("preview").hidden,
}));
let frameLive = false;
if (shown.embed) {
  frameLive = await p.frameLocator("#mapframe").locator(".wrap").count()
    .then((n) => n > 0).catch(() => false);
}
check("the map area is never an empty box",
  (shown.preview && !shown.embed) || (shown.embed && frameLive),
  `embed=${shown.embed} preview=${shown.preview} frameMounted=${frameLive}`);

// 3 ── the built-in corridor picker computes from the register
const verdictEN = await p.evaluate(() => {
  document.getElementById("orig").value = "US";
  document.getElementById("dest").value = "EU";
  document.getElementById("orig").dispatchEvent(new Event("change"));
  return document.getElementById("v-cls").textContent;
});
check("picker computes US→EU", /Category I/.test(verdictEN), verdictEN);

// 4 ── the timeline slider reclassifies corridors
const beforeCount = await p.textContent("#pcount");
await p.evaluate(() => { const s = document.getElementById("asof"); s.value = "1"; s.dispatchEvent(new Event("input")); });
const afterCount = await p.textContent("#pcount");
check("timeline slider reclassifies", /\b0\b/.test(beforeCount) && /\b8\b/.test(afterCount), `${beforeCount.trim()} -> ${afterCount.trim()}`);
await p.evaluate(() => { const s = document.getElementById("asof"); s.value = "0"; s.dispatchEvent(new Event("input")); });

// 5 ── switch to Chinese and hunt for blocks that stayed English
await p.click('#langtog button[data-lang="zh"]');
await p.waitForTimeout(400);

// Deliberately left in English: schema field names in the formula, and the real titles of
// the SSRN papers (a translated title is not the one a reader can search for).
const ALLOW = [
  /^(claim_class|evidence_tier|status) =/,
  /^ORCID [0-9]/,
  /^(The Multi-Jurisdiction|Narrowing the Section|Cross-Border (Stablecoin|Digital-Finance)|Citable by Construction|Three Mechanisms, One Policy)/,
  /Duke FinReg Blog/,
];
const leftovers = await p.evaluate((cjkSrc) => {
  const cjk = new RegExp(cjkSrc);
  const bad = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const s = (n.nodeValue || "").trim();
    if (s.length < 25) continue;
    if (cjk.test(s)) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style")) continue;
    // Publication titles stay in the original language by design — they are citation
    // handles, and a translated title retrieves nothing from SSRN or sec.gov.
    if (el.closest(".idx-t, .paper .t")) continue;
    if (el.offsetParent === null) continue; // not visible
    bad.push({ sec: (el.closest("section") || {}).id || "?", text: s.slice(0, 90) });
  }
  return bad;
}, CJK.source);
const realLeftovers = leftovers.filter((l) => !ALLOW.some((re) => re.test(l.text)));
check("no untranslated block in Chinese mode", realLeftovers.length === 0,
  realLeftovers.map((l) => `[#${l.sec}] ${l.text}`).join("\n      "));

// 6 ── nav is fully translated (was 7 links / 6 translations)
const navZh = await p.evaluate(() => [...document.querySelectorAll(".nav a.hideable")].map((a) => a.textContent.trim()));
check("all 7 nav links translated", navZh.every((s) => CJK_TEST(s)) , navZh.join(" | "));
function CJK_TEST(s) { return CJK.test(s); }

// 7 ── the about block must not repeat the author bio twice
const who = await p.textContent("#about .who");
const sub = await p.textContent("#about .sub");
check("about paragraphs are not duplicated", !(who.includes("Yunjie Fan") && sub.includes("Yunjie Fan")),
  `who="${who.slice(0, 40)}…" sub="${sub.slice(0, 40)}…"`);

// 8 ── switching back to English must fully restore
await p.click('#langtog button[data-lang="en"]');
await p.waitForTimeout(300);
const backEn = await p.textContent("#status .kick");
check("language toggle round-trips", /status/i.test(backEn), backEn);

// 9 ── console + network hygiene (fonts and the remote mapper are expected offline)
const noisy = failedReqs.filter((u) => !/fonts\.(googleapis|gstatic)|github\.io/.test(u));
check("no unexpected failed requests", noisy.length === 0, noisy.join(", "));
// The remote mapper is unreachable in this sandbox; that 403 is the case the watchdog
// above is designed for, not a page defect. Everything else must be silent.
const realErrs = consoleErrs.filter((m) => !/status of 403|net::ERR/.test(m));
// ── every hosted paper link must resolve to a file that exists ──────────────
const pdfLinks = await p.evaluate(() =>
  [...document.querySelectorAll('a[href$=".pdf"]')]
    .map((a) => a.getAttribute("href"))
    .filter((h) => !/^https?:/.test(h)));
const missing = [];
for (const rel of pdfLinks) {
  const abs = path.resolve(path.dirname(FILE.replace("file://", "")), rel);
  if (!fs.existsSync(abs)) missing.push(rel);
}
check("every hosted PDF link resolves", missing.length === 0, missing.join(", "));
check("the analysis index is populated", pdfLinks.length >= 6, `${pdfLinks.length} hosted PDFs`);

// ── the index must be in reverse-chronological order ───────────────────────
const dates = await p.evaluate(() =>
  [...document.querySelectorAll(".idx-date")].map((e) => Date.parse(e.textContent.trim())));
const ordered = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
check("analysis index is reverse-chronological", ordered && dates.every((d) => !isNaN(d)));

// ── nothing on the page may read as a submission ───────────────────────────
const subs = /submitted for review|under review|manuscript|submission|anonymi[sz]ed|投稿|审稿/i;
const pageText = await p.innerText("main, body");
check("no submission language on the page", !subs.test(pageText), (pageText.match(subs) || [""])[0]);


check("no console errors", realErrs.length === 0, realErrs.join(" | "));

await b.close();

let bad = 0;
console.log("\nLANDING PAGE\n");
for (const r of out) {
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name}${r.detail && !r.ok ? "\n      " + r.detail : (r.detail ? `  (${r.detail})` : "")}`);
  if (!r.ok) bad++;
}
console.log(bad ? `\n${bad} failing\n` : `\nall ${out.length} checks pass\n`);
process.exit(bad ? 1 : 0);
