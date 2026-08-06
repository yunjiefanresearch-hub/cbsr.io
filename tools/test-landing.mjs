import { chromium } from "playwright";   // npx playwright install chromium
import path from "node:path";

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

// 2 ── the embed must NOT be showing when the mapper is unreachable
const embedHidden = await p.evaluate(() => document.getElementById("embed").hidden);
const previewShown = await p.evaluate(() => !document.getElementById("preview").hidden);
check("blank iframe never shown when mapper unreachable", embedHidden && previewShown);

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
