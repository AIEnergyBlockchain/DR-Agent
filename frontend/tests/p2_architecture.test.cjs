const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf-8');

// ── R1: Dirty flags for selective re-rendering ───────────────

test('dirty flags object is defined', () => {
  assert.match(js, /dirty\s*=\s*\{/,
    'dirty flags object must be defined');
});

test('dirty flags cover key render regions', () => {
  // Must track at least: mission, hero, kpi, evidence, visual, crosschain
  assert.match(js, /dirty\.\w*mission|dirty\[['"]mission['"]\]/i,
    'dirty flags must include mission');
  assert.match(js, /dirty\.\w*kpi|dirty\[['"]kpi['"]\]/i,
    'dirty flags must include kpi');
  assert.match(js, /dirty\.\w*visual|dirty\[['"]visual['"]\]/i,
    'dirty flags must include visual');
});

test('renderAll checks dirty flags before calling sub-renderers', () => {
  // renderAll should conditionally skip renderers based on dirty flags
  const renderBody = js.match(/function renderAll\(\)[\s\S]*?^}/m);
  assert.ok(renderBody, 'renderAll must exist');
  assert.ok(
    renderBody[0].includes('dirty.') || renderBody[0].includes('dirty['),
    'renderAll must check dirty flags');
});

test('markDirty function exists to set dirty flags', () => {
  assert.match(js, /function markDirty/,
    'markDirty function must be defined');
});

test('state mutations mark relevant regions dirty', () => {
  // When state changes, dirty flags should be set
  assert.match(js, /markDirty\(/,
    'markDirty must be called on state changes');
});

// ── R2: StatePersistence centralized module ──────────────────

test('PERSIST_KEYS mapping is defined', () => {
  assert.match(js, /PERSIST_KEYS\s*=\s*\{/,
    'PERSIST_KEYS mapping must be defined');
});

test('PERSIST_KEYS covers all localStorage keys', () => {
  // Must map: dr_builder_open, dr_camera_mode, dr_theme, dr_view_mode, dr_lang
  assert.match(js, /dr_builder_open/);
  assert.match(js, /dr_camera_mode/);
  assert.match(js, /dr_theme/);
  assert.match(js, /dr_view_mode/);
  assert.match(js, /dr_lang/);
});

test('persistState function exists', () => {
  assert.match(js, /function persistState/,
    'persistState function must centralize localStorage writes');
});

test('loadPersistedState function exists', () => {
  assert.match(js, /function loadPersistedState/,
    'loadPersistedState function must centralize localStorage reads');
});

test('no scattered localStorage.setItem calls outside persistence module', () => {
  // Count direct localStorage.setItem calls — should only be inside persistState
  const directCalls = (js.match(/localStorage\.setItem\(/g) || []).length;
  const inPersist = (js.match(/function persistState[\s\S]*?^}/m) || [''])[0];
  const persistCalls = (inPersist.match(/localStorage\.setItem\(/g) || []).length;
  // Allow at most 1 extra call outside (e.g. lang switch which is also a persist call)
  assert.ok(directCalls <= persistCalls + 1,
    `All localStorage.setItem calls should be centralized: ${directCalls} total, ${persistCalls} in persistState`);
});

// ── R3: Error retry UI ───────────────────────────────────────

test('retry button exists in error card HTML', () => {
  assert.match(html, /id="errorRetryBtn"|id="btnErrorRetry"/,
    'error card must contain a retry button');
});

test('retry button has i18n label', () => {
  assert.match(html, /data-i18n="error\.retry"|data-i18n="action\.retry"/,
    'retry button must have i18n key');
});

test('retry button CSS exists', () => {
  assert.match(css, /error-retry|btnErrorRetry|\.retry-btn/,
    'retry button must have CSS styles');
});

test('JS wires retry button to re-execute last failed action', () => {
  assert.match(js, /errorRetryBtn|btnErrorRetry/,
    'JS must reference the retry button');
  assert.match(js, /lastFailedAction|retryLastAction|lastAction.*retry/i,
    'JS must track the last failed action for retry');
});

test('retry button is hidden when no error', () => {
  // The retry button should be display:none or hidden when there's no error
  const btnMatch = html.match(/(id="errorRetryBtn"|id="btnErrorRetry")[^>]*/);
  assert.ok(btnMatch, 'retry button must exist');
  // Should start hidden (style="display:none" or class containing hidden)
  assert.ok(
    btnMatch[0].includes('display:none') || btnMatch[0].includes('hidden'),
    'retry button must be initially hidden');
});

test('error retry i18n keys exist in EN and ZH', () => {
  assert.match(js, /['"]error\.retry['"]/,
    'error.retry i18n key must exist');
});

// ── Regression: P0 + P1 still pass ──────────────────────────

test('P0 regression: skip-link exists', () => {
  assert.match(html, /class="skip-link"/);
});

test('P0 regression: API_TIMEOUT_MS defined', () => {
  assert.match(js, /API_TIMEOUT_MS\s*=\s*\d+/);
});

test('P1 regression: destroyDemoCharts exists', () => {
  assert.match(js, /function destroyDemoCharts/);
});

test('P1 regression: KPI flip keyboard handler', () => {
  assert.match(js, /kpi-flip-container[\s\S]*?keydown/);
});

test('P1 regression: activateTab has null guard', () => {
  const fn = js.match(/function activateTab[\s\S]*?^}/m);
  assert.ok(fn[0].includes('if (!panel)'));
});
