/* CBSR — browser tests for the multi-page site.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/test-site.mjs .
 *
 * Playwright is not a dependency of this repo. Install it when you want to run these.
 *
 * The suite drives real Chromium over the files on disk, in the unstamped state they
 * sit in before deploy, because that is the state a contributor opens locally and the
 * one where the runtime fallbacks have to hold.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(process.argv[2] || ".");
const url = (f) => "file://" + path.join(ROOT, f);
const CJK = /[\u3400-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/;

const PAGES = ["index.html", "corridors.html", "agents.html", "kya.html",
               "method.html", "research.html", "standards.html", "maintain.html",
               "about.html", "thanks.html", "404.html"];

const out = [];
const check = (name, ok, detail) => out.push({ name, ok, detail: detail || "" });

const b = await chromium.launch();
const p = await b.newPage();
const consoleErrs = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });

/* ── 1 ─ every page loads, carries the shell, and marks itself in the nav ───── */
for (const f of PAGES) {
  await p.goto(url(f));
  await p.waitForTimeout(200);
  const state = await p.evaluate(() => ({
    nav: document.querySelectorAll(".nav a").length,
    foot: document.querySelectorAll(".footnav a").length,
    tog: !!document.getElementById("langtog"),
    css: !!getComputedStyle(document.body).fontFamily.match(/Plex|serif|sans/i),
    on: document.querySelectorAll(".nav a.on").length,
    title: document.title,
  }));
  check(`${f}: shell present`,
    state.nav === 8 && state.foot === 8 && state.tog && state.css,
    `nav=${state.nav} foot=${state.foot} tog=${state.tog}`);
  /* index, thanks and 404 are not nav entries, so no link is marked there */
  const expectMark = !["index.html", "thanks.html", "404.html"].includes(f);
  check(`${f}: current page marked in nav`, expectMark ? state.on === 1 : state.on === 0,
    `marked=${state.on}`);
  check(`${f}: has a title`, state.title.length > 5, state.title);
}

/* ── 2 ─ no unstamped placeholder is ever visible to a reader ───────────────── */
await p.goto(url("maintain.html"));
await p.waitForTimeout(300);
const leftovers = await p.evaluate(() =>
  [...document.querySelectorAll("meta,link,input")]
    .map((e) => e.getAttribute("content") || e.getAttribute("href") || e.getAttribute("value") || "")
    .filter((v) => v.includes("__SITE_URL__")).length);
check("runtime fallback fills __SITE_URL__ in an unstamped copy", leftovers === 0, `${leftovers} left`);

/* ── 3 ─ switching to Chinese leaves no untranslated block, on every page ──── */
for (const f of PAGES) {
  await p.goto(url(f));
  await p.waitForTimeout(200);
  await p.click('#langtog button[data-lang="zh"]');
  await p.waitForTimeout(250);
  const holes = await p.evaluate((cjkSrc) => {
    const CJK = new RegExp(cjkSrc);
    /* Titles of published work are citation handles and stay in their original
       language by design; mono tokens are code, not prose. */
    const exempt = (el) => el.closest(".idx-t, .mono, .env, .idlinks, .paper .t, .kv");
    return [...document.querySelectorAll("[data-zh]")]
      .filter((el) => !exempt(el) && el.textContent.trim().length > 12
                   && !CJK.test(el.textContent)).length;
  }, CJK.source);
  check(`${f}: no untranslated block in 中文`, holes === 0, `${holes} block(s)`);
  const lang = await p.evaluate(() => document.documentElement.lang);
  check(`${f}: html lang follows the toggle`, lang.startsWith("zh"), lang);
}

/* ── 4 ─ the corridor engine computes rather than reciting a typed table ─────
 * Section 3 left the stored language on 中文, and localStorage survives navigation
 * inside one context. Ask for English explicitly rather than assert against whichever
 * language the previous test happened to leave behind. */
await p.goto(url("corridors.html") + "?lang=en");
await p.waitForTimeout(400);
const usEU = await p.evaluate(() => {
  const o = document.getElementById("orig"), d = document.getElementById("dest");
  o.value = "US"; d.value = "EU"; o.dispatchEvent(new Event("change"));
  return document.getElementById("v-cls").textContent;
});
check("US→EU reads Category I", /Category I\b/.test(usEU), usEU);

const euUS = await p.evaluate(() => {
  const o = document.getElementById("orig"), d = document.getElementById("dest");
  o.value = "EU"; d.value = "US"; o.dispatchEvent(new Event("change"));
  return document.getElementById("v-cls").textContent;
});
check("EU→US reads Category T — direction changes the answer",
  /Category T\b/.test(euUS), euUS);

const before = await p.textContent("#pcount");
await p.evaluate(() => { const s = document.getElementById("asof"); s.value = "1"; s.dispatchEvent(new Event("input")); });
const mid = await p.textContent("#pcount");
await p.evaluate(() => { const s = document.getElementById("asof"); s.value = "2"; s.dispatchEvent(new Event("input")); });
const after = await p.textContent("#pcount");
check("the date control reclassifies corridors 0 → 8 → 16",
  /\b0\b/.test(before) && /\b8\b/.test(mid) && /\b16\b/.test(after),
  `${before.trim()} | ${mid.trim()} | ${after.trim()}`);

const flipped = await p.evaluate(() => {
  const o = document.getElementById("orig"), d = document.getElementById("dest");
  o.value = "EU"; d.value = "US"; o.dispatchEvent(new Event("change"));
  return document.getElementById("v-cls").textContent;
});
check("EU→US resolves to Category II once §18 has commenced",
  /Category II\b/.test(flipped), flipped);

/* ── 5 ─ the map area is never an empty box ─────────────────────────────────── */
await p.goto(url("corridors.html") + "?lang=en");
await p.waitForTimeout(1400);
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
  `embed=${shown.embed} preview=${shown.preview} mounted=${frameLive}`);

/* ── 6 ─ the analysis index filters, and is reverse-chronological ───────────── */
await p.goto(url("research.html") + "?lang=en");
await p.waitForTimeout(300);
const dates = await p.evaluate(() =>
  [...document.querySelectorAll(".idx-date")].map((e) => Date.parse(e.textContent.trim())));
check("analysis index is reverse-chronological",
  dates.every((d, i) => i === 0 || dates[i - 1] >= d), dates.join(" "));

await p.fill("#idxq", "Reves");
await p.waitForTimeout(150);
const filtered = await p.evaluate(() =>
  [...document.querySelectorAll(".idx-item")].filter((li) => !li.hidden).length);
check("index filter narrows the list", filtered >= 1 && filtered < dates.length, `${filtered} shown`);

await p.fill("#idxq", "zzzzz");
await p.waitForTimeout(150);
const emptyMsg = await p.evaluate(() => {
  const e = document.querySelector(".idx-empty");
  return e && !e.hidden ? e.textContent.trim() : "";
});
check("index filter says so when nothing matches", emptyMsg.length > 0, emptyMsg);

/* ── 7 ─ the application form's contract ────────────────────────────────────── */
await p.goto(url("maintain.html") + "?lang=en");
await p.waitForTimeout(300);
const form = await p.evaluate(() => {
  const f = document.getElementById("apply");
  return {
    action: f.getAttribute("action") || "",
    method: (f.getAttribute("method") || "").toUpperCase(),
    next: (f.querySelector('[name="_next"]') || {}).value || "",
    honey: !!f.querySelector('[name="_honey"]'),
    honeyHidden: (() => {
      const h = f.querySelector('[name="_honey"]');
      if (!h) return false;
      const r = h.getBoundingClientRect();
      return r.left < 0 || r.width <= 1;
    })(),
    required: f.querySelectorAll("[required]").length,
    fields: f.querySelectorAll("input[name],select[name],textarea[name]").length,
    jurisdictions: f.querySelectorAll('input[name="Jurisdiction"]').length,
  };
});
check("form posts to the relay", /formsubmit\.co\/yunjiefan\.research@gmail\.com/.test(form.action), form.action);
check("form method is POST", form.method === "POST", form.method);
/* Run locally the pages are unstamped, so the runtime fallback resolves _next against
   the file:// directory. What matters either way is that it is ABSOLUTE and points at
   thanks.html — the relay rejects a relative redirect. */
check("form redirects to an absolute thanks URL",
  /^(https?|file):\/\/.+thanks\.html$/.test(form.next), form.next);
check("honeypot exists and is off-canvas", form.honey && form.honeyHidden, `honey=${form.honey} hidden=${form.honeyHidden}`);
check("the three required fields are marked", form.required === 3, `${form.required} required`);
check("all twelve jurisdictions are offered", form.jurisdictions === 13, `${form.jurisdictions} boxes (12 + other)`);

/* the browser blocks submission until the required fields are filled */
const blocked = await p.evaluate(() => !document.getElementById("apply").checkValidity());
check("empty form does not submit", blocked === true, `valid=${!blocked}`);

await p.fill("#ap-name", "Test Person");
await p.fill("#ap-email", "test@example.org");
await p.fill("#ap-cell", "JP→HK reads Category II; under Art. Y of Act X it should read Category I.");
const nowValid = await p.evaluate(() => document.getElementById("apply").checkValidity());
check("filled form validates", nowValid === true, `valid=${nowValid}`);

/* The email fallback builds its text by walking fieldset → .f/.declare → label.
   window.location cannot be intercepted from page script, so rather than assert on a
   navigation that never fires, assert the structure the builder actually depends on:
   every answer-bearing control must sit inside a .f or .declare, inside a fieldset,
   next to a label the builder can read. This is precisely what silently breaks the
   fallback when a field is added in a hurry. */
const walkable = await p.evaluate(() => {
  const f = document.getElementById("apply");
  const controls = [...f.querySelectorAll("input[name],select[name],textarea[name]")]
    .filter((el) => el.type !== "hidden" && el.name !== "_honey");
  const orphan = [], unlabelled = [];
  for (const el of controls) {
    const block = el.closest(".f, .declare");
    if (!block || !block.closest("fieldset")) { orphan.push(el.name); continue; }
    const lab = block.querySelector("label, .flab");
    if (!lab || lab.textContent.trim().length < 2) unlabelled.push(el.name);
  }
  return {
    controls: controls.length,
    orphan: [...new Set(orphan)],
    unlabelled: [...new Set(unlabelled)],
    legends: f.querySelectorAll("fieldset > legend").length,
  };
});
check("every field sits in a .f/.declare inside a fieldset",
  walkable.orphan.length === 0, walkable.orphan.join(", "));
check("every field block carries a label the builder can read",
  walkable.unlabelled.length === 0, walkable.unlabelled.join(", "));
check("every fieldset has a legend for the email fallback's section headers",
  walkable.legends === 5, `${walkable.legends} legends, ${walkable.controls} controls`);

/* ── 8 ─ the link graph closes: no internal href points at a missing file ──── */
let dead = [];
for (const f of PAGES) {
  await p.goto(url(f));
  const hrefs = await p.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  for (const h of hrefs) {
    if (!h || /^(https?:|mailto:|#|\/\/)/.test(h)) continue;
    const t = h.split("#")[0].split("?")[0];
    if (t && !fs.existsSync(path.join(ROOT, t))) dead.push(`${f} → ${t}`);
  }
}
check("no internal link points at a missing file", dead.length === 0, dead.join(", "));

/* ── 9 ─ nothing threw ────────────────────────────────────────────────────────
 * Only script errors count. Over file:// the webfonts and the mapper iframe are
 * cross-origin and fail to load by design; that is the case the built-in picker and
 * the local font stack exist to cover, so treating it as a failure would assert the
 * opposite of what this site is built to survive. */
const scriptErrs = consoleErrs.filter(
  (m) => !/Failed to load resource|net::ERR_|ERR_BLOCKED|preload/i.test(m));
check("no script errors", scriptErrs.length === 0, scriptErrs.slice(0, 3).join(" | "));
if (consoleErrs.length !== scriptErrs.length) {
  console.log(`  note   ${consoleErrs.length - scriptErrs.length} resource load failure(s) ignored (offline / file://)`);
}

await b.close();

let bad = 0;
for (const r of out) {
  if (!r.ok) bad++;
  console.log(`${r.ok ? "  ok  " : "  FAIL"}  ${r.name}${r.detail ? "   — " + r.detail : ""}`);
}
console.log(`\n${out.length - bad}/${out.length} passed`);
process.exit(bad ? 1 : 0);
