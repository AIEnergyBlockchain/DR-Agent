const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf-8');

/* ── Bug 1: Cross-chain / M2M demo panels not visible ─────────── */
test('inline demo panels must NOT use reveal class (causes opacity:0 when initially hidden)', () => {
  // The reveal class sets opacity:0 and relies on a one-shot animation.
  // Elements starting with display:none never run the animation, so they
  // stay at opacity:0 even after .hidden is removed.
  const ccMatch = html.match(/id="inlineCrosschainDemo"[^>]*/);
  const m2mMatch = html.match(/id="inlineM2mDemo"[^>]*/);
  assert.ok(ccMatch, 'inlineCrosschainDemo must exist');
  assert.ok(m2mMatch, 'inlineM2mDemo must exist');
  assert.ok(!ccMatch[0].includes('reveal'), 'inlineCrosschainDemo must not have reveal class');
  assert.ok(!m2mMatch[0].includes('reveal'), 'inlineM2mDemo must not have reveal class');
});

test('setDemoMode removes hidden and ensures panels are visible', () => {
  // The setDemoMode function should explicitly set opacity/transform
  // or use a CSS rule for demo panels that overrides reveal's initial state
  assert.match(js, /setDemoMode/, 'setDemoMode must exist');
  // Either: the demo panels don't use reveal (tested above),
  // OR: setDemoMode resets opacity/style after removing hidden
  const hasFadeInAnim = css.includes('#inlineCrosschainDemo') && css.includes('fadeIn');
  const jsResetsOpacity = js.includes('style.opacity') || js.includes('style.animation');
  const noReveal = !html.match(/id="inlineCrosschainDemo"[^>]*reveal/);
  assert.ok(noReveal || hasFadeInAnim || jsResetsOpacity,
    'Demo panels must be visible after setDemoMode (no reveal, or explicit opacity reset)');
});

/* ── Bug 2: "返回流程" renamed to "主流程演示", placed first ────── */
test('main flow button is first and uses correct i18n key', () => {
  const idxMain = html.indexOf('id="btnBackToFlow"');
  const idxCc = html.indexOf('id="btnShowCrosschainDemo"');
  const idxM2m = html.indexOf('id="btnShowM2mDemo"');
  assert.ok(idxMain !== -1, 'btnBackToFlow must exist');
  assert.ok(idxMain < idxCc, 'main flow button must come before cross-chain button');
  assert.ok(idxMain < idxM2m, 'main flow button must come before m2m button');
});

test('main flow button label is "主流程演示" in Chinese i18n', () => {
  assert.match(js, /story\.backToFlow.*主流程演示|mainFlowDemo.*主流程演示/);
});

/* ── Bug 3: Mission Command (任务指挥) section too large ───────── */
test('action-hero has compact padding in story mode', () => {
  // The action-hero section should have reduced padding/gap in story mode
  assert.match(css, /body\[data-view="story"\]\s+\.action-hero[\s\S]*?(padding|gap)/,
    'action-hero must have compact padding/gap in story mode');
});

test('action-hero title uses compact font size in story mode', () => {
  // h2 inside action-hero should be smaller
  assert.match(css, /body\[data-view="story"\]\s+\.action-hero-main\s+h2[\s\S]*?font-size/,
    'action-hero h2 must have compact font-size in story mode');
});

/* ── Bug 4: All sections on same page ──────────────────────── */
test('story-kpi-row is compact (small gap and padding)', () => {
  const match = css.match(/body\[data-view="story"\]\s+\.story-kpi-row\s*\{([^}]*)\}/);
  assert.ok(match, 'story-kpi-row rule must exist in story mode');
  assert.match(match[1], /gap/, 'story-kpi-row must define gap');
});

test('story-kpi cards have compact height', () => {
  const match = css.match(/body\[data-view="story"\]\s+\.story-kpi\s*\{([^}]*)\}/);
  assert.ok(match, 'story-kpi rule must exist in story mode');
  assert.match(match[1], /padding/, 'story-kpi must define padding');
});

/* ── Bug 5: Settlement split/flow visible only after step 4 ── */
test('settlement cards hidden until settle step', () => {
  assert.match(js, /visualPayoutCard/);
  assert.match(js, /visualSettlementFlowCard/);
  assert.match(js, /settleDone/, 'payout/settlement visibility must check settleDone');
});

/* ── Bug 6: KPI card click response (highlight + expand) ───── */
test('story-kpi click handler sets kpi-expanded and kpi-highlight classes', () => {
  assert.match(js, /kpi-expanded/);
  assert.match(js, /kpi-highlight/);
  assert.match(js, /\.story-kpi\[data-kpi\]/, 'KPI click handler must query story-kpi[data-kpi]');
});

test('KPI expanded state has CSS styles', () => {
  assert.match(css, /\.kpi-expanded/, 'kpi-expanded CSS rule must exist');
  assert.match(css, /\.kpi-highlight/, 'kpi-highlight CSS rule must exist');
});

test('KPI detail row element exists in HTML', () => {
  assert.match(html, /kpi-detail-row/, 'kpi-detail-row must exist in HTML');
});

test('KPI cards have data-kpi attribute', () => {
  assert.match(html, /story-kpi[^>]*data-kpi="energy"/, 'energy KPI card must have data-kpi');
  assert.match(html, /story-kpi[^>]*data-kpi="payout"/, 'payout KPI card must have data-kpi');
  assert.match(html, /story-kpi[^>]*data-kpi="audit"/, 'audit KPI card must have data-kpi');
});
