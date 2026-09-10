import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const script = fs.readFileSync(new URL('../assets/cbsr-live.js', import.meta.url), 'utf8');
const register = process.env.CBSR_TEST_REGISTER
  ? path.resolve(process.env.CBSR_TEST_REGISTER)
  : fileURLToPath(new URL('../../cross-border-stablecoin-register/', import.meta.url));
const meta = JSON.parse(fs.readFileSync(path.join(register, 'api/meta.json'), 'utf8'));
const worklist = JSON.parse(fs.readFileSync(path.join(register, 'api/worklist.json'), 'utf8'));

function element(attributes = {}, text = 'fallback') {
  return {
    attributes, textContent: text, children: [],
    getAttribute(key) { return this.attributes[key]; },
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); },
  };
}

async function render(payload, tasks = worklist) {
  const records = element({ 'data-live': 'records' });
  const strict = element({ 'data-live': 'decision_ready' });
  const stamp = element();
  const html = element({ lang: 'en' });
  const nodes = Object.fromEntries(['wl-list', 'wl-count', 'wl-state'].map(id => [id, element()]));
  const document = {
    readyState: 'complete', documentElement: html,
    querySelectorAll: selector => selector === '[data-live]' ? [records, strict] : [stamp],
    getElementById: id => nodes[id], createElement: () => element(),
  };
  vm.runInNewContext(script, {
    document, window: { addEventListener() {} },
    fetch: async url => {
      if (payload instanceof Error) throw payload;
      return { ok: true, json: async () => url.endsWith('meta.json') ? payload : tasks };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { records, strict, stamp, html, nodes };
}

test('valid metadata and worklist update a dated snapshot, without claiming current law', async () => {
  const page = await render(structuredClone(meta));
  assert.equal(page.html.attributes['data-cbsr-live'], 'live');
  assert.equal(page.records.textContent, String(meta.data.record_count));
  assert.equal(page.strict.textContent, '0');
  assert.match(page.stamp.textContent, /not legal-currentness evidence/);
  assert.equal(page.nodes['wl-list'].children.length, worklist.data.items.length);
});

for (const [label, mutate] of [
  ['missing strict count', m => delete m.data.citable_count],
  ['missing tool count', m => delete m.data.mcp_tool_count],
  ['string count', m => { m.data.record_count = '152'; }],
  ['inconsistent counts', m => { m.data.citable_count = 47; }],
  ['invalid date', m => { m.generated = '2026-02-30'; }],
  ['date suffix', m => { m.generated += 'junk'; }],
  ['mismatched version', m => { m.data.version = '0.12.0'; }],
  ['missing review evidence', m => delete m.data.review_coverage],
]) {
  test(`${label} preserves fallback and does not mark incomplete data as live`, async () => {
    const payload = structuredClone(meta);
    mutate(payload);
    const page = await render(payload);
    assert.equal(page.html.attributes['data-cbsr-live'], 'offline');
    assert.equal(page.records.textContent, 'fallback');
    assert.equal(page.strict.textContent, 'fallback');
    assert.match(page.nodes['wl-state'].textContent, /metadata unavailable/);
    assert.equal(page.nodes['wl-count'].textContent, '\u2014');
  });
}

test('network failure leaves fallback untouched', async () => {
  const page = await render(new Error('offline'));
  assert.equal(page.html.attributes['data-cbsr-live'], 'offline');
  assert.equal(page.records.textContent, 'fallback');
  assert.match(page.nodes['wl-state'].textContent, /metadata unavailable/);
  assert.equal(page.nodes['wl-count'].textContent, '\u2014');
});

test('mixed-version worklist is rejected without rendering its rows', async () => {
  const tasks = structuredClone(worklist);
  tasks.version = '0.12.0';
  const page = await render(meta, tasks);
  assert.equal(page.nodes['wl-list'].children.length, 0);
  assert.match(page.nodes['wl-state'].textContent, /could not be read/);
});
