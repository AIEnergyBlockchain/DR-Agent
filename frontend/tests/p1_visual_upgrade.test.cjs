const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf-8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf-8');

// ── P1-1: Chart.js integration ──────────────────────────────

test('Chart.js CDN script is included in HTML', () => {
  assert.match(html, /chart\.js|Chart\.min\.js|chart\.umd/i);
});

test('canvas elements exist for comparison and payout charts', () => {
  assert.match(html, /id="chartComparison"/);
  assert.match(html, /id="chartPayout"/);
});

test('JS initializes Chart instances for comparison and payout', () => {
  assert.match(js, /new Chart\(/);
  assert.match(js, /chartComparison/);
  assert.match(js, /chartPayout/);
});

test('renderVisualInsights updates chart data', () => {
  assert.match(js, /\.update\(\)/);
});

test('chart theme colors use CSS variable palette', () => {
  // Charts should use the project cyan/lime/purple palette
  assert.match(js, /59,\s*217,\s*255|3bd9ff|accent-cyan/i);
});

// ── P1-11: Success confetti + failure ripple ─────────────────

test('confetti function exists in JS', () => {
  assert.match(js, /function (launchConfetti|showConfetti|celebrateSuccess)/);
});

test('failure ripple CSS class exists', () => {
  assert.match(css, /failure-ripple|error-ripple|shake-error/);
});

test('confetti triggers on full flow completion', () => {
  // Should be called when all steps are done
  assert.match(js, /(launchConfetti|showConfetti|celebrateSuccess)\(/);
});

test('confetti respects reduced-motion preference', () => {
  assert.match(js, /prefers-reduced-motion|reducedMotion/);
});

// ── P1-3: Sankey / settlement flow diagram ───────────────────

test('canvas element exists for settlement flow', () => {
  assert.match(html, /id="chartSettlementFlow"/);
});

test('JS renders settlement flow visualization', () => {
  assert.match(js, /chartSettlementFlow|renderSettlementFlow|SettlementFlow/);
});

test('settlement flow shows DRT distribution path', () => {
  // Should reference Settlement contract -> sites flow
  assert.match(js, /Settlement|settlement.*flow|drt.*flow/i);
});

// ── P0 regression: countUp still works ───────────────────────

test('animateValue function exists with easeOutExpo', () => {
  assert.match(js, /function animateValue/);
  assert.match(js, /easeOutExpo|2,\s*-10/);
});

test('glassmorphism backdrop-filter is applied', () => {
  assert.match(css, /backdrop-filter:\s*blur\(/);
});

test('pulse ring animation exists for in-progress steps', () => {
  assert.match(css, /@keyframes pulseRing/);
});
