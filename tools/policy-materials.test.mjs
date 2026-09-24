import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(path.join(ROOT, name));
const text = (name) => read(name).toString("utf8");
const home = text("index.html");
const research = text("research.html");
const CJK = /[\u3400-\u9fff]/;

const EXPECTED_CARDS = ["treasury-part-1523", "eleven-votes-short", "mica-review", "sec-section-404"];
const LOCAL_PDFS = new Map([
  ["papers/treasury-part1523-comment.pdf", "ec666f38cb5f6e292d73031892d10286a69b1f334e36717f114fdf4d3d677739"],
  ["papers/clarity-act-analysis-20260917.pdf", "ba57e65a3ffcf6d7a53a16593899050bbc533a3ba74d728af2e5e64a016904c7"],
]);
const OFFICIAL_LINKS = [
  "https://www.regulations.gov/comment/TREAS-DO-2026-0496-0031",
  "https://finance.ec.europa.eu/regulation-and-supervision/consultations-0/targeted-consultation-review-mica-regulation_en",
  "https://finance.ec.europa.eu/document/download/62be7015-f066-4fac-b74e-71bacdbcc9f5_en?filename=2026-mica-review-targeted-consultation-document_en.pdf",
  "https://www.sec.gov/files/ctf-written-input-fan-050726.pdf",
  "https://www.sec.gov/featured-topics/crypto-task-force/crypto-task-force-written-input",
];

function elementById(markup, tag, id) {
  const hit = markup.match(new RegExp(`<${tag}\\b(?=[^>]*\\bid="${id}")[^>]*>[\\s\\S]*?<\\/${tag}>`));
  assert.ok(hit, `${tag}#${id} must exist`);
  return hit[0];
}

function articles(markup, attribute) {
  return [...markup.matchAll(new RegExp(`<article\\b(?=[^>]*\\b${attribute}="([^"]+)")[^>]*>([\\s\\S]*?)<\\/article>`, "g"))]
    .map((hit) => ({ id: hit[1], html: hit[0] }));
}

function hrefs(markup) {
  return [...markup.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)].map((hit) => hit[1]);
}

function card(cards, id) {
  const found = cards.find((entry) => entry.id === id);
  assert.ok(found, `missing ${id} card`);
  return found.html;
}

test("landing page publishes exactly the four bounded policy-material cards", () => {
  const section = elementById(home, "section", "policy-participation");
  const cards = articles(section, "data-policy-card");
  assert.deepEqual(cards.map((entry) => entry.id), EXPECTED_CARDS);

  for (const entry of cards) {
    for (const field of ["data-policy-title", "data-policy-summary", "data-policy-boundary"]) {
      const hit = entry.html.match(new RegExp(`<[^>]+\\b${field}(?:="[^"]*")?[^>]*\\bdata-zh="([^"]+)"[^>]*>`));
      assert.ok(hit, `${entry.id} ${field} must carry a Chinese translation`);
      assert.match(hit[1], CJK, `${entry.id} ${field} data-zh must contain Chinese text`);
    }
  }

  const local = hrefs(section).filter((href) => href.startsWith("papers/"));
  assert.deepEqual(local, [...LOCAL_PDFS.keys()]);
  const external = hrefs(section).filter((href) => /^https:\/\//.test(href));
  assert.deepEqual(external, OFFICIAL_LINKS);
  for (const link of section.matchAll(/<a\b([^>]+)>/g)) {
    if (/href="https:\/\//.test(link[1])) {
      assert.match(link[1], /target="_blank"/);
      assert.match(link[1], /rel="noopener"/);
    }
  }
});

test("the four cards retain their dated status and non-endorsement boundaries", () => {
  const section = elementById(home, "section", "policy-participation");
  const cards = articles(section, "data-policy-card");
  const treasury = card(cards, "treasury-part-1523");
  assert.match(treasury, /posted 21 September 2026/);
  assert.match(treasury, /material current through 20 September 2026/);
  assert.match(treasury, /does not indicate Treasury endorsement, agreement, adoption, or validation/);

  const analysis = card(cards, "eleven-votes-short");
  assert.match(analysis, /17 September 2026/);
  assert.match(analysis, /not legal or investment advice and not a live statement of law/);
  assert.match(analysis, /not repeated here as an independently verified current fact/);

  const mica = card(cards, "mica-review");
  assert.match(mica, /submission receipt received/);
  assert.match(mica, /30 September 2026, 23:59 CEST/);
  assert.match(mica, /The CBSR response is not public/);
  assert.match(mica, /no European Commission endorsement, acceptance, adoption, or validation is claimed/);
  assert.match(mica, /Official consultation document &middot; 45 pp PDF/);

  const sec = card(cards, "sec-section-404");
  assert.match(sec, /listed 7 May 2026/);
  assert.match(sec, /brief dated 6 May 2026/);
  assert.match(sec, /28 pp PDF/);
  assert.match(sec, /not an SEC position, review finding, or endorsement/);
  assert.match(sec, /AI-generated and not reviewed by the Task Force/);
  assert.match(sec, /summary is based on the original submission/);
});

test("private MiCA evidence and interactive fields cannot leak through public markup", () => {
  const section = elementById(home, "section", "policy-participation");
  const index = elementById(research, "section", "policy-participation-index");
  const publicMarkup = section + index;
  assert.doesNotMatch(publicMarkup, /mica-review-questionnaire-2026\.pdf/i);
  const withoutPublicDocumentUrl = publicMarkup.split(OFFICIAL_LINKS[2]).join("");
  assert.doesNotMatch(withoutPublicDocumentUrl, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  assert.doesNotMatch(publicMarkup, /csrf(?:token)?=|session[_-]?token=|receipt[_-]?id=|\/edit(?:\/|\?|$)/i);
  assert.doesNotMatch(publicMarkup, /<(?:img|form|input|script)\b/i);
  assert.doesNotMatch(card(articles(section, "data-policy-card"), "mica-review"), /href="papers\//);
});

test("historical structural-citable language is separated from the current strict contract", () => {
  const section = elementById(home, "section", "policy-participation");
  assert.match(section, /Historical attachments preserve the term &ldquo;structural citable&rdquo;/);
  assert.match(section, /data-live="structural_candidates">46</);
  assert.equal((section.match(/data-live="decision_ready">0</g) || []).length, 2);
  assert.match(section, /strictly citable records/);
  assert.match(section, /decision-ready records/);
  assert.match(section, /terminology is not rewritten retrospectively/);
});

test("research page indexes the same four materials without duplicating private evidence", () => {
  const index = elementById(research, "section", "policy-participation-index");
  const items = [...index.matchAll(/data-policy-index-item="([^"]+)"/g)].map((hit) => hit[1]);
  assert.deepEqual(items, EXPECTED_CARDS);
  for (const href of [...LOCAL_PDFS.keys(), ...OFFICIAL_LINKS]) assert.match(index, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(index, /The MiCA response, receipt identifiers, and private access path are not public/);
  assert.doesNotMatch(index, /mica-review-questionnaire-2026\.pdf/i);
});

test("the two author PDFs are the reviewed immutable originals", () => {
  for (const [file, expected] of LOCAL_PDFS) {
    const actual = createHash("sha256").update(read(file)).digest("hex");
    assert.equal(actual, expected, `${file} SHA-256 drifted`);
  }
});
