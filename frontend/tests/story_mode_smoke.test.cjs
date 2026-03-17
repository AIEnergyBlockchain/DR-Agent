const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf-8');

test('story mode includes agent insight panel', () => {
  assert.match(html, /id="storyAgentInsight"/);
  assert.match(html, /id="storyInsightHeadline"/);
  assert.match(html, /id="storyInsightMeta"/);
});

test('story demo buttons show main flow first', () => {
  const idxMain = html.indexOf('id="btnBackToFlow"');
  const idxCc = html.indexOf('id="btnShowCrosschainDemo"');
  const idxM2m = html.indexOf('id="btnShowM2mDemo"');
  assert.ok(idxMain !== -1 && idxCc !== -1 && idxM2m !== -1, 'missing story demo buttons');
  assert.ok(idxMain < idxCc && idxCc < idxM2m, 'main flow button should be left of demos');
});

test('story main flow demo label is updated in i18n', () => {
  assert.match(js, /story\.backToFlow': 'Main Flow Demo'/);
  assert.match(js, /story\.backToFlow': '主流程演示'/);
});

test('story mode includes challenge placeholder', () => {
  assert.match(html, /id="storyChallenge"/);
});

test('story mode hides crosschain and extra visual cards', () => {
  assert.match(css, /body\[data-view="story"\] #storyCrosschainSummary/);
  assert.match(css, /body\[data-view="story"\] #visualBaselineCard/);
});

test('auto run is primary CTA in story hero', () => {
  assert.match(html, /id="btnRunAllHero" class="[^"]*btn-main-cta/);
});

test('story evidence buttons are compact', () => {
  assert.match(html, /id="btnStoryTechEvidence" class="[^"]*btn-compact/);
  assert.match(html, /id="btnStorySnapshot" class="[^"]*btn-compact/);
});

test('agent insight wiring includes story handlers', () => {
  assert.match(js, /storyInsightHeadline/);
  assert.match(js, /renderStoryConfidenceBar/);
  assert.match(js, /renderDataPointsInto/);
  assert.match(js, /typewriterRender\(el\.storyInsightHeadline/);
  assert.match(css, /\.muted-line\.typing::after/);
});

test('agent insight avoids aborting same-step request', () => {
  const stepIndex = js.indexOf('stepKey === agentState.lastStep');
  const abortIndex = js.indexOf('agentState.abortController.abort');
  assert.ok(stepIndex !== -1 && abortIndex !== -1, 'missing step or abort check');
  assert.ok(stepIndex < abortIndex, 'step check should happen before abort');
});

test('baseline comparison refresh is wired', () => {
  assert.match(js, /function refreshBaselineComparison/);
  assert.match(js, /refreshBaselineComparison\(\);/);
});

test('baseline compare API call is present', () => {
  assert.match(js, /baseline\/compare/);
});

test('baseline result is stored for agent insight', () => {
  assert.match(js, /baselineResult/);
});

test('payout card shows confidence weighting placeholder', () => {
  assert.match(html, /id="visualConfidenceWeight"/);
  assert.match(html, /id="visualConfidenceMethod"/);
});

test('agent insight skips API when no event', () => {
  assert.match(js, /fetchAgentInsight[\s\S]*if \(!state\.event\)/);
});
