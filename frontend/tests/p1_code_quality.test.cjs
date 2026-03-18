const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf-8');

// ── Q1: Chart instance cleanup on demo/view switch ───────────

test('destroyDemoCharts function exists', () => {
  assert.match(js, /function destroyDemoCharts/,
    'destroyDemoCharts must be defined to clean up chart instances');
});

test('destroyDemoCharts calls .destroy() on chart instances', () => {
  // Must destroy cc and m2m charts
  assert.match(js, /ccBridgeChart\.destroy\(\)/,
    'must destroy ccBridgeChart');
  assert.match(js, /m2mDrtChart\.destroy\(\)/,
    'must destroy m2mDrtChart');
});

test('destroyDemoCharts nullifies chart references after destroy', () => {
  assert.match(js, /ccBridgeChart\s*=\s*null/,
    'must nullify ccBridgeChart after destroy');
  assert.match(js, /ccIcmChart\s*=\s*null/,
    'must nullify ccIcmChart after destroy');
  assert.match(js, /m2mDrtChart\s*=\s*null/,
    'must nullify m2mDrtChart after destroy');
  assert.match(js, /m2mKwhChart\s*=\s*null/,
    'must nullify m2mKwhChart after destroy');
});

test('setDemoMode calls destroyDemoCharts when switching away', () => {
  // When leaving a demo mode, charts should be destroyed
  const setDemoBody = js.match(/function setDemoMode\([\s\S]*?^}/m);
  assert.ok(setDemoBody, 'setDemoMode must exist');
  assert.ok(setDemoBody[0].includes('destroyDemoCharts'),
    'setDemoMode must call destroyDemoCharts when switching modes');
});

// ── Q3: KPI flip cards keyboard support ──────────────────────

test('kpi-flip-container has tabindex="0" in HTML', () => {
  const containers = html.match(/class="[^"]*kpi-flip-container[^"]*"[^>]*/g);
  assert.ok(containers && containers.length >= 6, 'must have kpi-flip-container elements');
  for (const c of containers) {
    assert.ok(c.includes('tabindex="0"'),
      `kpi-flip-container must have tabindex="0": ${c.substring(0, 80)}`);
  }
});

test('kpi-flip-container has role="button" for accessibility', () => {
  const containers = html.match(/class="[^"]*kpi-flip-container[^"]*"[^>]*/g);
  for (const c of containers) {
    assert.ok(c.includes('role="button"'),
      `kpi-flip-container must have role="button": ${c.substring(0, 80)}`);
  }
});

test('JS handles keydown Enter/Space on kpi-flip-container', () => {
  assert.match(js, /kpi-flip-container[\s\S]*?keydown/,
    'must add keydown listener to kpi-flip-container');
  assert.match(js, /Enter|Space|\x20/,
    'keydown handler must check for Enter or Space key');
});

test('story-kpi cards have tabindex="0"', () => {
  const storyKpis = html.match(/class="story-kpi[^"]*"[^>]*/g);
  assert.ok(storyKpis && storyKpis.length >= 3, 'must have story-kpi elements');
  for (const k of storyKpis) {
    if (k.includes('data-kpi')) {
      assert.ok(k.includes('tabindex="0"'),
        `story-kpi with data-kpi must have tabindex="0": ${k.substring(0, 80)}`);
    }
  }
});

test('JS handles keydown Enter/Space on story-kpi', () => {
  assert.match(js, /story-kpi[\s\S]*?keydown|keydown[\s\S]*?story-kpi/,
    'must add keydown listener to story-kpi cards');
});

// ── Q4: Demo buttons disabled state during run ───────────────

test('demo run functions disable button at start and re-enable at end', () => {
  // runInlineCcDemo should disable btnInlineCcDemo
  assert.match(js, /btnInlineCcDemo[\s\S]*?disabled\s*=\s*true/,
    'runInlineCcDemo must disable its button');
  assert.match(js, /btnInlineM2mDemo[\s\S]*?disabled\s*=\s*true/,
    'runInlineM2mDemo must disable its button');
});

test('demo buttons re-enabled after demo completes', () => {
  // After demo run, button should be re-enabled (in finally block)
  assert.match(js, /btnInlineCcDemo[\s\S]*?disabled\s*=\s*false/,
    'btnInlineCcDemo must be re-enabled after demo');
  assert.match(js, /btnInlineM2mDemo[\s\S]*?disabled\s*=\s*false/,
    'btnInlineM2mDemo must be re-enabled after demo');
});

// ── Q5: Crosschain data error logging ────────────────────────

test('refreshCrosschainData logs errors instead of silently swallowing', () => {
  const fnBody = js.match(/async function refreshCrosschainData\(\)[\s\S]*?^}/m);
  assert.ok(fnBody, 'refreshCrosschainData must exist');
  // Should NOT have empty catch blocks
  const silentCatches = (fnBody[0].match(/catch\s*\([^)]*\)\s*\{\s*\/\*\s*silent\s*\*\/\s*\}/g) || []).length;
  assert.equal(silentCatches, 0,
    'refreshCrosschainData must not have silent catch blocks');
  // Should log errors
  assert.ok(fnBody[0].includes('appendLog') || fnBody[0].includes('console.'),
    'refreshCrosschainData must log errors');
});

// ── Q6: activateTab null guards ──────────────────────────────

test('activateTab has null guards for panel access', () => {
  const fnBody = js.match(/function activateTab[\s\S]*?^}/m);
  assert.ok(fnBody, 'activateTab must exist');
  // Must check if panel exists before calling methods
  assert.ok(
    fnBody[0].includes('if (!panel') || fnBody[0].includes('panel?.') || fnBody[0].includes('if (panel)'),
    'activateTab must guard against null panels');
});

// ── Regression: P0 optimizations still present ───────────────

test('P0 regression: scheduleRender still exists', () => {
  assert.match(js, /function scheduleRender/);
});

test('P0 regression: API_TIMEOUT_MS still defined', () => {
  assert.match(js, /API_TIMEOUT_MS/);
});

test('P0 regression: aria-live on storyAgentInsight', () => {
  assert.match(html, /id="storyAgentInsight"[^>]*aria-live/);
});

test('P0 regression: flow-timeline has role="list"', () => {
  assert.match(html, /class="flow-timeline"[^>]*role="list"/);
});

test('P0 regression: skip-link exists', () => {
  assert.match(html, /class="skip-link"/);
});
