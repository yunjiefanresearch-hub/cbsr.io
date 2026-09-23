#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER_ROOT = path.resolve(
  process.argv[2] || path.join(SITE_ROOT, '..', 'cross-border-stablecoin-register')
);
const FORMAL_DATASET_NAME = 'Cross-Border Stablecoin Register';

/* This is a deliberate public snapshot contract, not a second data source.
   When the pinned Register revision moves, update these fallbacks in the same
   change so an offline page never publishes figures from a different release. */
const EXPECTED = Object.freeze({
  version: '0.11.0',
  generated: '2026-08-20',
  records: 152,
  jurisdictions: 12,
  strictCitable: 0,
  structuralCandidates: 46,
  authoredCorridors: 9,
  directedCorridors: 132,
  mcpTools: 40,
  worklistItems: 27,
  tier1WorklistItems: 23
});

let failures = 0;

function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  process.stdout.write(`${ok ? 'ok' : 'not ok'} - ${label}${detail ? ` (${detail})` : ''}\n`);
  if (!ok) failures += 1;
}

function readText(root, relative) {
  const full = path.join(root, relative);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (error) {
    process.stderr.write(`Could not read ${full}: ${error.message}\n`);
    process.exit(1);
  }
}

function readJson(root, relative) {
  const source = readText(root, relative);
  try {
    return JSON.parse(source);
  } catch (error) {
    process.stderr.write(`Invalid JSON in ${path.join(root, relative)}: ${error.message}\n`);
    process.exit(1);
  }
}

const metaDocument = readJson(REGISTER_ROOT, path.join('api', 'meta.json'));
const worklistDocument = readJson(REGISTER_ROOT, path.join('api', 'worklist.json'));
const mcpDocument = readJson(REGISTER_ROOT, 'mcp.json');
const meta = metaDocument.data || {};
const review = meta.review_coverage || {};
const tools = Array.isArray(mcpDocument.tools) ? mcpDocument.tools : [];
const worklist = worklistDocument.data || {};
const worklistItems = Array.isArray(worklist.items) ? worklist.items : [];
const jurisdictions = Array.isArray(meta.jurisdictions) ? meta.jurisdictions : [];
const toolNames = tools.map((tool) => tool && tool.name);
const worklistIds = worklistItems.map((item) => item && item.id);

process.stdout.write(`CBSR contract\n  site: ${SITE_ROOT}\n  register: ${REGISTER_ROOT}\n`);

check('formal dataset name is stable across Register surfaces',
  metaDocument.register === FORMAL_DATASET_NAME &&
  worklistDocument.register === FORMAL_DATASET_NAME &&
  mcpDocument.displayName === FORMAL_DATASET_NAME);
check('version agrees across meta, worklist, and MCP',
  metaDocument.version === EXPECTED.version &&
  meta.version === EXPECTED.version &&
  worklistDocument.version === EXPECTED.version &&
  mcpDocument.version === EXPECTED.version);
check('generated date matches the website snapshot', metaDocument.generated === EXPECTED.generated,
  `expected ${EXPECTED.generated}, got ${metaDocument.generated}`);
check('record count matches the website snapshot', meta.record_count === EXPECTED.records,
  `expected ${EXPECTED.records}, got ${meta.record_count}`);
check('jurisdictions are unique and match the snapshot',
  jurisdictions.length === EXPECTED.jurisdictions && new Set(jurisdictions).size === jurisdictions.length,
  `expected ${EXPECTED.jurisdictions}, got ${jurisdictions.length}`);

check('strict citable count remains distinct from structural candidates',
  meta.citable_count === EXPECTED.strictCitable &&
  review.decision_ready === EXPECTED.strictCitable &&
  meta.structural_citable_candidates === EXPECTED.structuralCandidates,
  `strict=${meta.citable_count}, structural=${meta.structural_citable_candidates}`);
check('directed corridor count is the complete ordered graph',
  meta.directed_corridors === EXPECTED.directedCorridors &&
  meta.directed_corridors === jurisdictions.length * (jurisdictions.length - 1),
  `expected ${EXPECTED.directedCorridors}, got ${meta.directed_corridors}`);
check('authored corridor subset is separately reported',
  meta.authored_corridors === EXPECTED.authoredCorridors &&
  meta.authored_corridors < meta.directed_corridors,
  `expected ${EXPECTED.authoredCorridors}, got ${meta.authored_corridors}`);

check('MCP manifest names every tool exactly once',
  tools.length === EXPECTED.mcpTools &&
  new Set(toolNames).size === tools.length &&
  toolNames.every(Boolean),
  `expected ${EXPECTED.mcpTools}, got ${tools.length}`);
check('meta MCP count is generated from the manifest', meta.mcp_tool_count === tools.length,
  `meta=${meta.mcp_tool_count}, manifest=${tools.length}`);
check('decision-ready MCP surface exists', toolNames.includes('citable_law'));

const tier1Items = worklistItems.filter((item) => item && item.claim_class === 'tier1_legal');
check('worklist is read from api/worklist.json and has the expected envelope',
  worklistDocument.endpoint === 'verification_worklist' && worklist.status === 'preview');
check('worklist snapshot has the expected number of unique tasks',
  worklistItems.length === EXPECTED.worklistItems &&
  new Set(worklistIds).size === worklistItems.length &&
  worklistIds.every(Boolean),
  `expected ${EXPECTED.worklistItems}, got ${worklistItems.length}`);
check('worklist tier-1 headline is derived from its items',
  tier1Items.length === EXPECTED.tier1WorklistItems &&
  worklist.headline && worklist.headline.tier1_legal_unverified === tier1Items.length,
  `headline=${worklist.headline && worklist.headline.tier1_legal_unverified}, items=${tier1Items.length}`);
check('every worklist task carries a resolvable public-review contract',
  worklistItems.every((item) =>
    item &&
    jurisdictions.includes(item.jurisdiction) &&
    typeof item.dimension === 'string' && item.dimension.length > 0 &&
    typeof item.instrument === 'string' && item.instrument.length > 0 &&
    item.missing_for && Array.isArray(item.missing_for.resolution_text)
  ));

const htmlFiles = fs.readdirSync(SITE_ROOT).filter((name) => name.endsWith('.html'));
const html = Object.fromEntries(htmlFiles.map((name) => [name, readText(SITE_ROOT, name)]));
const allHtml = Object.values(html).join('\n');
const agents = html['agents.html'] || '';
const index = html['index.html'] || '';
const corridors = html['corridors.html'] || '';
const liveScript = readText(SITE_ROOT, path.join('assets', 'cbsr-live.js'));

check('every published page uses CBSR as its Open Graph product brand',
  htmlFiles.every((name) => html[name].includes('<meta property="og:site_name" content="CBSR">')));
check('served pages do not publish the abandoned settlement-register rename',
  !allHtml.includes('Cross-Border Settlement Register'));
check('served pages do not claim the formal dataset name is a former name',
  !allHtml.includes('formerly the Cross-Border Stablecoin Register') &&
  !allHtml.includes('原名 Cross-Border Stablecoin Register'));
check('formal dataset citation name remains discoverable',
  (html['about.html'] || '').includes(`<i>${FORMAL_DATASET_NAME}</i>`) &&
  (html['research.html'] || '').includes(`<i>${FORMAL_DATASET_NAME}</i>`));

check('site binds complete directed corridors, never authored exemplars, to 132 labels',
  index.includes('data-live="directed_corridors">132</span>') &&
  corridors.includes('data-live="directed_corridors">132</span>') &&
  !allHtml.includes('data-live="authored_corridors"') &&
  !allHtml.includes('data-live=&quot;authored_corridors&quot;'));
check('agent page fallback exposes strict and structural counts separately',
  agents.includes(`data-live="decision_ready">${EXPECTED.strictCitable}</span> strict records`) &&
  agents.includes(`data-live="structural_candidates">${EXPECTED.structuralCandidates}</span> structural candidates`));
check('MCP tool fallback is generated from the same snapshot',
  agents.includes(`data-live="mcp_tool_count">${EXPECTED.mcpTools}</span> typed MCP tools`) &&
  index.includes(`data-live="mcp_tool_count">${EXPECTED.mcpTools}</span> typed tools`));
check('old citable and tool-count claims are absent from served pages',
  !/roughly\s+(?:30|thirty)|~30|46\s+records\s*[·&]/i.test(allHtml));
check('live binder maps all three independent generated counters',
  liveScript.includes('directed_corridors: d.directed_corridors') &&
  liveScript.includes('authored_corridors: d.authored_corridors') &&
  liveScript.includes('mcp_tool_count: d.mcp_tool_count'));
check('worklist fetch uses the deployed API filename',
  liveScript.includes("'/worklist.json'") &&
  !liveScript.includes("'/verification-worklist.json'"));

if (failures) {
  process.stderr.write(`\nCBSR contract failed: ${failures} check${failures === 1 ? '' : 's'} failed.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\nCBSR contract passed: ${EXPECTED.records} records, ${EXPECTED.strictCitable} strict / ${EXPECTED.structuralCandidates} structural, ${EXPECTED.directedCorridors} directed / ${EXPECTED.authoredCorridors} authored, ${EXPECTED.mcpTools} MCP tools, ${EXPECTED.worklistItems} worklist tasks.\n`);
}
