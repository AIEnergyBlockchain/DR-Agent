const FLOW_STEPS = [
  { id: 'create', label: 'Create' },
  { id: 'proofs', label: 'Proofs' },
  { id: 'close', label: 'Close' },
  { id: 'settle', label: 'Settle' },
  { id: 'claim', label: 'Claim' },
  { id: 'audit', label: 'Audit' },
];
const VIEW_MODES = ['story', 'ops', 'engineering'];
const REQUIRED_PROOF_SITES = ['site-a', 'site-b'];

const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = {
  control: document.getElementById('tab-control'),
  event: document.getElementById('tab-event'),
  audit: document.getElementById('tab-audit'),
};
const TAB_ORDER = ['control', 'event', 'audit'];
const MAX_LOG_ENTRIES = 320;

const el = {
  log: document.getElementById('log'),
  btnViewStory: document.getElementById('btnViewStory'),
  btnViewOps: document.getElementById('btnViewOps'),
  btnViewEngineering: document.getElementById('btnViewEngineering'),
  modeHint: document.getElementById('modeHint'),
  builderPanel: document.getElementById('builderPanel'),
  btnTheme: document.getElementById('btnTheme'),
  btnCameraMode: document.getElementById('btnCameraMode'),
  btnJudgeMode: document.getElementById('btnJudgeMode'),
  btnNextStep: document.getElementById('btnNextStep'),
  btnRunAllHero: document.getElementById('btnRunAllHero'),
  btnExportSnapshot: document.getElementById('btnExportSnapshot'),
  snapshotFeedback: document.getElementById('snapshotFeedback'),
  eventIdInput: document.getElementById('eventId'),
  baseUrl: document.getElementById('baseUrl'),
  operatorKey: document.getElementById('operatorKey'),
  participantKey: document.getElementById('participantKey'),
  auditorKey: document.getElementById('auditorKey'),
  auditSiteId: document.getElementById('auditSiteId'),

  missionEventId: document.getElementById('missionEventId'),
  missionChainMode: document.getElementById('missionChainMode'),
  missionStep: document.getElementById('missionStep'),
  missionHealth: document.getElementById('missionHealth'),
  missionLatency: document.getElementById('missionLatency'),
  flowProgressText: document.getElementById('flowProgressText'),
  flowProgressBar: document.getElementById('flowProgressBar'),
  heroTitle: document.getElementById('heroTitle'),
  heroSubtitle: document.getElementById('heroSubtitle'),
  storyEnergy: document.getElementById('storyEnergy'),
  storyPayout: document.getElementById('storyPayout'),
  storyAudit: document.getElementById('storyAudit'),
  storyInsight: document.getElementById('storyInsight'),

  kpiStatus: document.getElementById('kpiStatus'),
  kpiStatusHint: document.getElementById('kpiStatusHint'),
  kpiCardStatus: document.getElementById('kpiCardStatus'),
  kpiCoverage: document.getElementById('kpiCoverage'),
  kpiCoverageHint: document.getElementById('kpiCoverageHint'),
  kpiCardCoverage: document.getElementById('kpiCardCoverage'),
  kpiPayout: document.getElementById('kpiPayout'),
  kpiPayoutHint: document.getElementById('kpiPayoutHint'),
  kpiCardPayout: document.getElementById('kpiCardPayout'),
  kpiClaim: document.getElementById('kpiClaim'),
  kpiClaimHint: document.getElementById('kpiClaimHint'),
  kpiCardClaim: document.getElementById('kpiCardClaim'),
  kpiAudit: document.getElementById('kpiAudit'),
  kpiAuditHint: document.getElementById('kpiAuditHint'),
  kpiCardAudit: document.getElementById('kpiCardAudit'),
  kpiLatency: document.getElementById('kpiLatency'),
  kpiLatencyHint: document.getElementById('kpiLatencyHint'),
  kpiCardLatency: document.getElementById('kpiCardLatency'),

  evidenceProofA: document.getElementById('evidenceProofA'),
  evidenceProofB: document.getElementById('evidenceProofB'),
  proofABar: document.getElementById('proofABar'),
  proofBBar: document.getElementById('proofBBar'),
  proofADelta: document.getElementById('proofADelta'),
  proofBDelta: document.getElementById('proofBDelta'),
  evidenceAuditResult: document.getElementById('evidenceAuditResult'),
  evidenceAuditHash: document.getElementById('evidenceAuditHash'),
  narrativeLine: document.getElementById('narrativeLine'),
  lastActionLine: document.getElementById('lastActionLine'),
  insightHeadline: document.getElementById('insightHeadline'),
  insightReason: document.getElementById('insightReason'),
  insightImpact: document.getElementById('insightImpact'),
  errorCard: document.getElementById('errorCard'),
  errorHeadline: document.getElementById('errorHeadline'),
  errorHint: document.getElementById('errorHint'),
  errorNext: document.getElementById('errorNext'),
  evidenceToggle: document.getElementById('evidenceToggle'),
  technicalEvidence: document.getElementById('technicalEvidence'),
};

const DEFAULT_ERROR_VIEW = {
  level: 'ok',
  headline: 'No active errors.',
  hint: 'Flow guards prevent most invalid actions.',
  next: 'Next: run the current highlighted step.',
};

const state = {
  event: null,
  proofs: {},
  settlements: [],
  audit: null,
  chainMode: 'unknown',
  lastLatencyMs: null,
  lastAction: 'none',
  lastError: '',
  stepErrors: {},
  evidenceOpen: false,
  errorView: { ...DEFAULT_ERROR_VIEW },
  busy: false,
  builderOpen: false,
  theme: 'cobalt',
  cameraMode: false,
  judgeMode: false,
  viewMode: 'story',
  judgeSummary: null,
  snapshotFeedback: '',
  logEntries: [],
  lastTransitionAt: '',
};

if (!el.eventIdInput.value) {
  el.eventIdInput.value = `event-ui-${Date.now()}`;
}

state.builderOpen = localStorage.getItem('dr_builder_open') === '1';
if (el.builderPanel) {
  el.builderPanel.open = state.builderOpen;
}

state.cameraMode = localStorage.getItem('dr_camera_mode') === '1';
if (state.cameraMode) {
  document.body.classList.add('camera-mode');
}

state.judgeMode = localStorage.getItem('dr_judge_mode') === '1';
if (state.judgeMode) {
  document.body.classList.add('judge-mode');
}

if (el.btnCameraMode) {
  el.btnCameraMode.textContent = state.cameraMode ? 'Disable Camera Mode' : 'Enable Camera Mode';
  el.btnCameraMode.setAttribute('aria-pressed', String(state.cameraMode));
}

const persistedTheme = localStorage.getItem('dr_theme');
state.theme = persistedTheme === 'neon' ? 'neon' : 'cobalt';
document.body.dataset.theme = state.theme;
if (el.btnTheme) {
  el.btnTheme.textContent = `Theme: ${state.theme === 'neon' ? 'Neon' : 'Cobalt'}`;
}

if (el.btnJudgeMode) {
  el.btnJudgeMode.textContent = state.judgeMode ? 'Disable Judge Mode' : 'Enable Judge Mode';
  el.btnJudgeMode.setAttribute('aria-pressed', String(state.judgeMode));
}

const persistedViewMode = localStorage.getItem('dr_view_mode');
state.viewMode = VIEW_MODES.includes(persistedViewMode) ? persistedViewMode : 'story';
document.body.dataset.view = state.viewMode;

function activateTab(key) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === key;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('tabindex', selected ? '0' : '-1');
  });
  Object.entries(panels).forEach(([name, panel]) => {
    const hidden = name !== key;
    panel.classList.toggle('hidden', hidden);
    panel.setAttribute('aria-hidden', String(hidden));
  });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    const key = tab.dataset.tab;
    activateTab(key);
  });

  tab.addEventListener('keydown', (event) => {
    const current = tab.dataset.tab;
    const idx = TAB_ORDER.indexOf(current);
    if (idx < 0) return;

    let next = idx;
    if (event.key === 'ArrowRight') next = (idx + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft') next = (idx - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_ORDER.length - 1;
    else return;

    event.preventDefault();
    const key = TAB_ORDER[next];
    activateTab(key);
    const target = tabs.find((candidate) => candidate.dataset.tab === key);
    if (target) target.focus();
  });
}

function cfg() {
  return {
    baseUrl: el.baseUrl.value.trim(),
    eventId: el.eventIdInput.value.trim(),
    operatorKey: el.operatorKey.value.trim(),
    participantKey: el.participantKey.value.trim(),
    auditorKey: el.auditorKey.value.trim(),
    auditSiteId: el.auditSiteId.value.trim() || 'site-a',
  };
}

function resetErrorView() {
  state.errorView = { ...DEFAULT_ERROR_VIEW };
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toLocaleString('en-US');
}

function formatKwh(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${formatNumber(value)} kWh`;
}

function formatPayout(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${formatNumber(value)} DRT`;
}

function shortHash(value) {
  if (!value || typeof value !== 'string') return '-';
  if (value.length < 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function clampStory(text) {
  if (!text) return '';
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function stepLabel(stepId) {
  const found = FLOW_STEPS.find((step) => step.id === stepId);
  return found ? found.label : 'Create';
}

function formatNetworkMode(mode) {
  const key = String(mode || '').toLowerCase();
  if (key === 'fuji') return 'Avalanche Fuji Testnet';
  if (key === 'mainnet') return 'Avalanche Mainnet';
  if (key === 'simulated') return 'Simulation';
  if (key === 'local') return 'Local Devnet';
  return mode || 'unknown';
}

function formatStepForSummary(stepId) {
  if (stepId === 'completed') return 'Completed';
  return stepLabel(stepId);
}

function siteDisplay(siteId) {
  if (state.viewMode === 'story') {
    if (siteId === 'site-a') return 'Participant A';
    if (siteId === 'site-b') return 'Participant B';
  }
  return siteId;
}

function applyViewMode(mode) {
  const next = VIEW_MODES.includes(mode) ? mode : 'story';
  state.viewMode = next;
  document.body.dataset.view = next;
  localStorage.setItem('dr_view_mode', next);

  const mapping = [
    { node: el.btnViewStory, mode: 'story' },
    { node: el.btnViewOps, mode: 'ops' },
    { node: el.btnViewEngineering, mode: 'engineering' },
  ];
  for (const item of mapping) {
    if (!item.node) continue;
    const active = item.mode === next;
    item.node.classList.toggle('is-active', active);
    item.node.setAttribute('aria-selected', String(active));
  }

  if (next === 'engineering') {
    state.evidenceOpen = true;
  }
}

function renderViewMode() {
  if (el.modeHint) {
    if (state.viewMode === 'story') el.modeHint.textContent = 'Story Mode focuses on one next action and business impact.';
    else if (state.viewMode === 'ops') el.modeHint.textContent = 'Ops Mode emphasizes flow status, guardrails, and execution detail.';
    else el.modeHint.textContent = 'Engineering Mode exposes raw evidence and diagnostic traces.';
  }

  if (el.btnExportSnapshot) {
    el.btnExportSnapshot.textContent =
      state.viewMode === 'engineering' ? 'Copy Engineer Snapshot' : 'Copy Judge Snapshot';
  }
}

function endpointToStep(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('/proofs') || m.includes('proof')) return 'proofs';
  if (m.includes('/close')) return 'close';
  if (m.includes('/settle') || m.includes('settle')) return 'settle';
  if (m.includes('/claim') || m.includes('claim')) return 'claim';
  if (m.includes('/audit') || m.includes('audit')) return 'audit';
  if (m.includes('/events') || m.includes('event')) return 'create';
  return '';
}

function clearStepError(stepId) {
  if (!stepId) return;
  delete state.stepErrors[stepId];
}

function clearErrorState() {
  state.lastError = '';
  resetErrorView();
}

function decodeError(message) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('event_not_closed') || normalized.includes('event_must_be_closed') || normalized.includes('must be closed')) {
    return {
      level: 'error',
      headline: 'Settle blocked: event is not closed.',
      hint: 'The protocol requires closing the event before settlement.',
      next: 'Next: click "4. Close Event", then retry settle.',
    };
  }

  if (normalized.includes('duplicate') || normalized.includes('already') || normalized.includes('proof_exists')) {
    return {
      level: 'warn',
      headline: 'Duplicate operation rejected.',
      hint: 'This step appears to be already completed for the current event.',
      next: 'Next: move to the next highlighted step.',
    };
  }

  if (normalized.includes('401') || normalized.includes('403') || normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return {
      level: 'error',
      headline: 'Authorization failed.',
      hint: 'API keys or actor permissions do not match backend expectations.',
      next: 'Next: verify Operator / Participant / Auditor keys in Builder Mode.',
    };
  }

  return {
    level: 'error',
    headline: 'Action failed.',
    hint: message,
    next: 'Next: follow the highlighted step and retry.',
  };
}

function setButtonState(id, enabled, reason = '') {
  const node = document.getElementById(id);
  if (!node) return;
  node.disabled = !enabled;
  node.title = enabled ? '' : reason;
}

function setKpiCardState(node, status) {
  if (!node) return;
  node.dataset.state = status;
}

function setTextWithPulse(node, nextText) {
  if (!node) return;
  const text = String(nextText);
  const changed = node.textContent !== text;
  node.textContent = text;
  if (!changed) return;
  node.classList.remove('value-updated');
  // Force reflow to restart animation for rapid updates.
  void node.offsetWidth;
  node.classList.add('value-updated');
}

function applyTheme(theme) {
  state.theme = theme === 'neon' ? 'neon' : 'cobalt';
  document.body.dataset.theme = state.theme;
  localStorage.setItem('dr_theme', state.theme);
  if (el.btnTheme) {
    el.btnTheme.textContent = `Theme: ${state.theme === 'neon' ? 'Neon' : 'Cobalt'}`;
  }
}

function toggleTheme() {
  const next = state.theme === 'cobalt' ? 'neon' : 'cobalt';
  applyTheme(next);
}

function renderSnapshotFeedback() {
  if (!el.snapshotFeedback) return;
  el.snapshotFeedback.textContent = state.snapshotFeedback || '';
}

function markTransition() {
  state.lastTransitionAt = new Date().toISOString();
}

async function refreshJudgeSummary() {
  const c = cfg();
  if (!c.eventId) {
    state.judgeSummary = null;
    return;
  }

  try {
    const data = await callApi(`/judge/${c.eventId}/summary`, 'GET', null, c.auditorKey, 'auditor-1');
    state.judgeSummary = data;
    if (data?.network_mode) state.chainMode = data.network_mode;
    if (data?.last_transition_at) state.lastTransitionAt = data.last_transition_at;
  } catch (err) {
    const text = String(err?.message || '');
    if (text.includes('/judge/') && text.includes('404')) {
      state.judgeSummary = null;
      return;
    }
    // Keep UI resilient when summary endpoint is unavailable.
    if (text.includes('/judge/')) return;
    throw err;
  }
}

function buildJudgeSnapshot() {
  const ui = deriveUiState();
  const coveragePct = Math.round((ui.proofCount / 2) * 100);
  const proofA = state.proofs['site-a'] || null;
  const proofB = state.proofs['site-b'] || null;

  return {
    generated_at: new Date().toISOString(),
    theme: state.theme,
    event_id: state.event?.event_id || cfg().eventId || '-',
    chain_mode: state.chainMode || 'unknown',
    current_step: ui.currentStep,
    health: ui.health,
    status: ui.eventStatus,
    progress: `${ui.completedSteps}/${ui.totalSteps}`,
    proof_coverage: `${ui.proofCount}/2 (${coveragePct}%)`,
    total_payout_drt: ui.totalPayout,
    claim_site_a: ui.claimRecord?.status || 'pending',
    audit_match: state.audit ? !!state.audit.match : null,
    latency_ms: state.lastLatencyMs == null ? null : Math.round(state.lastLatencyMs),
    narrative: buildNarrative(ui),
    proofs: {
      site_a: proofA
        ? {
            baseline_kwh: proofA.baseline_kwh,
            actual_kwh: proofA.actual_kwh,
            reduction_kwh: proofA.reduction_kwh,
          }
        : null,
      site_b: proofB
        ? {
            baseline_kwh: proofB.baseline_kwh,
            actual_kwh: proofB.actual_kwh,
            reduction_kwh: proofB.reduction_kwh,
          }
        : null,
    },
    audit: state.audit
      ? {
          match: !!state.audit.match,
          proof_hash_onchain: state.audit.proof_hash_onchain,
          proof_hash_recomputed: state.audit.proof_hash_recomputed,
        }
      : null,
  };
}

function snapshotToText(snapshot, mode = 'full') {
  const lines = [
    'DR Agent - Judge Snapshot',
    `Generated: ${snapshot.generated_at}`,
    `Event: ${snapshot.event_id}`,
    `Theme: ${snapshot.theme}`,
    `Chain Mode: ${snapshot.chain_mode}`,
    `Step: ${snapshot.current_step}`,
    `Health: ${snapshot.health}`,
    `Status: ${snapshot.status}`,
    `Progress: ${snapshot.progress}`,
    `Proof Coverage: ${snapshot.proof_coverage}`,
    `Total Payout: ${snapshot.total_payout_drt} DRT`,
    `Claim (site-a): ${snapshot.claim_site_a}`,
    `Audit Match: ${snapshot.audit_match === null ? 'pending' : snapshot.audit_match ? 'PASS' : 'MISMATCH'}`,
    `Latency: ${snapshot.latency_ms == null ? '--' : `${snapshot.latency_ms} ms`}`,
    `Story: ${snapshot.narrative}`,
  ];
  if (mode === 'brief') return lines.join('\n');
  return `${lines.join('\n')}\n\n${JSON.stringify(snapshot, null, 2)}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (_) {
    copied = false;
  } finally {
    document.body.removeChild(area);
  }
  return copied;
}

async function exportJudgeSnapshot() {
  const snapshot = buildJudgeSnapshot();
  const mode = state.viewMode === 'engineering' ? 'full' : 'brief';
  const text = snapshotToText(snapshot, mode);
  let copied = false;

  try {
    copied = await copyTextToClipboard(text);
  } catch (_) {
    copied = false;
  }

  state.snapshotFeedback = copied
    ? `${mode === 'full' ? 'Engineer' : 'Judge'} snapshot copied to clipboard.`
    : 'Clipboard unavailable. Snapshot was written to Technical Evidence.';

  if (!copied) {
    appendLog('snapshot export fallback', snapshot);
  } else {
    appendLog('snapshot export', {
      event_id: snapshot.event_id,
      step: snapshot.current_step,
      status: snapshot.status,
      audit_match: snapshot.audit_match,
    });
  }

  renderAll();
}

function focusStepForCamera(ui) {
  if (ui.currentStep === 'completed') return 'audit';
  return ui.currentStep;
}

function focusKpiForCamera(ui) {
  const step = focusStepForCamera(ui);
  if (step === 'create' || step === 'close') return 'status';
  if (step === 'proofs') return 'coverage';
  if (step === 'settle') return 'payout';
  if (step === 'claim') return 'claim';
  if (step === 'audit') return 'audit';
  return '';
}

function summarizeProof(siteId) {
  const proof = state.proofs[siteId];
  const tag = siteId === 'site-a' ? 'A' : 'B';
  const siteLabel = siteDisplay(siteId);
  if (!proof) return `Proof ${tag} (${siteLabel}): not submitted.`;
  return `Proof ${tag} (${siteLabel}): baseline ${proof.baseline_kwh}, actual ${proof.actual_kwh}, reduction ${proof.reduction_kwh}.`;
}

function getClaimRecord() {
  return state.settlements.find((row) => row.site_id === 'site-a');
}

function deriveUiState() {
  const proofCount = Object.keys(state.proofs).length;
  const proofsDone = REQUIRED_PROOF_SITES.every((siteId) => !!state.proofs[siteId]);
  const closeDone = ['closed', 'settled'].includes(state.event?.status || '');
  const settleDone = state.settlements.length > 0;
  const claimRecord = getClaimRecord();
  const claimDone = claimRecord?.status === 'claimed';
  const auditDone = !!state.audit || !!state.judgeSummary?.audit_requested;

  let currentStep = 'create';
  if (!state.event) currentStep = 'create';
  else if (!proofsDone) currentStep = 'proofs';
  else if (!closeDone) currentStep = 'close';
  else if (!settleDone) currentStep = 'settle';
  else if (!claimDone) currentStep = 'claim';
  else if (!auditDone) currentStep = 'audit';
  else currentStep = 'completed';

  const completedSteps = [!!state.event, proofsDone, closeDone, settleDone, claimDone, auditDone].filter(Boolean).length;
  const totalSteps = FLOW_STEPS.length;
  const progressPct = Math.round((completedSteps / totalSteps) * 100);
  const health = state.lastError
    ? 'error'
    : completedSteps === 0
      ? 'pending'
      : completedSteps >= totalSteps
        ? 'done'
        : 'in-progress';

  return {
    proofCount,
    proofsDone,
    closeDone,
    settleDone,
    claimDone,
    claimRecord,
    auditDone,
    currentStep,
    health,
    completedSteps,
    totalSteps,
    progressPct,
    eventStatus: state.event?.status || 'pending',
    totalPayout: state.settlements.reduce((sum, row) => sum + (row.payout || 0), 0),
  };
}

function getTotalReductionKwh() {
  return Object.values(state.proofs).reduce((sum, proof) => sum + Number(proof?.reduction_kwh || 0), 0);
}

function buildAgentInsight(ui) {
  const reduction = getTotalReductionKwh();
  const coverage = `${ui.proofCount}/2`;
  const claimStatus = ui.claimRecord?.status || 'pending';

  if (state.lastError) {
    return {
      headline: 'Execution risk detected.',
      reason: `Blocking issue at ${formatStepForSummary(endpointToStep(state.lastError) || ui.currentStep)}. Resolve and retry.`,
      impact: 'Impact: payout finality delayed until the blocking step is resolved.',
      story: 'Agent paused due to execution risk; operator action required.',
    };
  }

  if (!state.event) {
    return {
      headline: 'No event yet.',
      reason: 'Agent needs an event window to anchor proof collection and settlement policy.',
      impact: 'Impact: no measurable payout or audit evidence exists yet.',
      story: 'Waiting for mission data.',
    };
  }

  if (ui.currentStep === 'proofs') {
    return {
      headline: 'Collecting participant proofs.',
      reason: `Coverage is ${coverage}; both participant proofs are required before close.`,
      impact: 'Impact: payout model remains provisional until proof coverage is complete.',
      story: 'Awaiting proof submissions from both participants.',
    };
  }

  if (ui.currentStep === 'close') {
    return {
      headline: 'Ready to close scope.',
      reason: `Observed reduction ${formatKwh(reduction)} across submitted proofs.`,
      impact: 'Impact: closing locks settlement scope and prevents late proof drift.',
      story: 'Proof coverage is complete; close event to lock scope.',
    };
  }

  if (ui.currentStep === 'settle') {
    return {
      headline: 'Settlement is executable.',
      reason: 'Event scope is locked and reward/penalty rates can be applied deterministically.',
      impact: 'Impact: settlement computes payout and creates claimable records.',
      story: 'Event closed; trigger settlement to materialize payouts.',
    };
  }

  if (ui.currentStep === 'claim') {
    return {
      headline: 'Claim is pending.',
      reason: `Current claim state for Participant A: ${claimStatus}.`,
      impact: 'Impact: claim finalizes participant payout receipt.',
      story: 'Settlement done; participant claim is the next critical action.',
    };
  }

  if (ui.currentStep === 'audit') {
    return {
      headline: 'Audit verification pending.',
      reason: 'Run hash verification to confirm on-chain anchor and recomputed payload match.',
      impact: 'Impact: audit pass unlocks judge-grade confidence in evidence integrity.',
      story: 'Claims complete; run audit to verify data integrity.',
    };
  }

  return {
    headline: 'Closed loop finalized.',
    reason: 'Create -> proofs -> close -> settle -> claim -> audit path has completed.',
    impact: 'Impact: payout and audit evidence are both finalized.',
    story: 'Closed loop complete: settleable, claimable, auditable.',
  };
}

function flowStepStatus(stepId, ui) {
  if (state.stepErrors[stepId]) return 'error';
  if (stepId === 'create' && state.event) return 'done';
  if (stepId === 'proofs' && ui.proofsDone) return 'done';
  if (stepId === 'close' && ui.closeDone) return 'done';
  if (stepId === 'settle' && ui.settleDone) return 'done';
  if (stepId === 'claim' && ui.claimDone) return 'done';
  if (stepId === 'audit' && ui.auditDone) return 'done';
  if (ui.currentStep === stepId) return 'in-progress';
  return 'pending';
}

function renderMissionStrip(ui) {
  const summary = state.judgeSummary;
  el.missionEventId.textContent = state.event?.event_id || summary?.event_id || cfg().eventId || '-';
  el.missionChainMode.textContent = formatNetworkMode(summary?.network_mode || state.chainMode || 'unknown');
  const stepFromSummary = summary?.current_step || ui.currentStep;
  el.missionStep.textContent = formatStepForSummary(stepFromSummary);
  el.missionLatency.textContent = state.lastLatencyMs == null ? '--' : `${Math.round(state.lastLatencyMs)} ms`;

  const progressCompleted = summary?.progress_completed ?? ui.completedSteps;
  const progressTotal = summary?.progress_total ?? ui.totalSteps;
  const progressPct = summary?.progress_pct ?? ui.progressPct;
  if (el.flowProgressText) {
    el.flowProgressText.textContent = `${progressCompleted} / ${progressTotal} (${progressPct}%)`;
  }
  if (el.flowProgressBar) {
    el.flowProgressBar.style.width = `${progressPct}%`;
  }

  const health = state.lastError ? 'error' : summary?.health || ui.health;
  el.missionHealth.textContent = health;
  el.missionHealth.className = `status-chip ${health}`;
}

function renderFlowTimeline(ui) {
  for (const step of FLOW_STEPS) {
    const node = document.getElementById(`step-${step.id}`);
    if (!node) continue;
    const status = flowStepStatus(step.id, ui);
    node.classList.remove('pending', 'in-progress', 'done', 'error');
    node.classList.add(status);
    const statusNode = node.querySelector('.step-state');
    if (statusNode) statusNode.textContent = status;
  }
}

function renderKpiGrid(ui) {
  const summary = state.judgeSummary;
  const coverageCount = summary?.proof_submitted ?? ui.proofCount;
  const coverageNeed = summary?.proof_required ?? REQUIRED_PROOF_SITES.length;
  const coveragePct = Math.round((coverageCount / coverageNeed) * 100);
  const eventStatus = summary?.event_status || ui.eventStatus;
  const totalPayout = summary?.total_payout_drt ?? ui.totalPayout;
  const claimStatus = summary?.claim_site_a_status || ui.claimRecord?.status || 'pending';
  const auditRequested = summary?.audit_requested ?? !!state.audit;
  const auditMatch = summary?.audit_match ?? (state.audit ? !!state.audit.match : null);

  setTextWithPulse(el.kpiStatus, eventStatus);
  if (eventStatus === 'pending') el.kpiStatusHint.textContent = 'Create an event to start the mission.';
  else if (eventStatus === 'active') el.kpiStatusHint.textContent = 'Event is active and accepting proofs.';
  else if (eventStatus === 'closed') el.kpiStatusHint.textContent = 'Event is closed and ready for settlement.';
  else el.kpiStatusHint.textContent = 'Settlement finalized at protocol layer.';

  setTextWithPulse(el.kpiCoverage, `${coverageCount} / ${coverageNeed} (${coveragePct}%)`);
  el.kpiCoverageHint.textContent = ui.proofsDone
    ? 'Both participant proofs are registered.'
    : 'Waiting for both Participant A and Participant B proofs.';

  setTextWithPulse(el.kpiPayout, formatPayout(totalPayout));
  el.kpiPayoutHint.textContent = ui.settleDone
    ? 'Sum of all settlement records for this event (DRT).'
    : 'Payout appears after settlement execution.';

  setTextWithPulse(el.kpiClaim, claimStatus);
  el.kpiClaimHint.textContent = ui.claimDone
    ? 'Participant A claim is complete.'
    : 'Participant A claim not finalized yet.';

  setTextWithPulse(el.kpiAudit, !auditRequested ? 'pending' : auditMatch ? 'PASS' : 'MISMATCH');
  el.kpiAuditHint.textContent = !auditRequested
    ? 'Audit endpoint not called yet.'
    : auditMatch
      ? 'On-chain hash matches recomputed hash.'
      : 'Hash mismatch detected. Investigate payload integrity.';

  setTextWithPulse(el.kpiLatency, state.lastLatencyMs == null ? '-- ms' : `${Math.round(state.lastLatencyMs)} ms`);
  el.kpiLatencyHint.textContent = 'Latest API round-trip from browser.';

  const statusState = state.stepErrors.create
    ? 'error'
    : eventStatus === 'settled'
      ? 'done'
      : eventStatus === 'active' || eventStatus === 'closed'
        ? 'in-progress'
        : 'pending';
  const coverageState = state.stepErrors.proofs ? 'error' : ui.proofsDone ? 'done' : coverageCount > 0 ? 'in-progress' : 'pending';
  const payoutState = state.stepErrors.settle ? 'error' : ui.settleDone ? 'done' : ui.closeDone ? 'in-progress' : 'pending';
  const claimState = state.stepErrors.claim ? 'error' : ui.claimDone ? 'done' : ui.settleDone ? 'in-progress' : 'pending';
  const auditState = state.stepErrors.audit || (auditRequested && !auditMatch) ? 'error' : auditMatch ? 'done' : ui.claimDone ? 'in-progress' : 'pending';
  const latencyState = state.lastError ? 'error' : state.lastLatencyMs == null ? 'pending' : 'done';

  setKpiCardState(el.kpiCardStatus, statusState);
  setKpiCardState(el.kpiCardCoverage, coverageState);
  setKpiCardState(el.kpiCardPayout, payoutState);
  setKpiCardState(el.kpiCardClaim, claimState);
  setKpiCardState(el.kpiCardAudit, auditState);
  setKpiCardState(el.kpiCardLatency, latencyState);
}

function buildNarrative(ui) {
  if (state.lastError) {
    const step = stepLabel(endpointToStep(state.lastError) || ui.currentStep);
    const compact = state.lastError.length > 90 ? `${state.lastError.slice(0, 90)}...` : state.lastError;
    return clampStory(`${step} failed: ${compact}`);
  }

  if (ui.currentStep === 'completed') {
    return 'Closed loop complete: settleable, claimable, auditable.';
  }
  if (ui.currentStep === 'audit') {
    return 'Claims are complete. Run audit to verify hash consistency.';
  }
  if (ui.currentStep === 'claim') {
    return 'Settlement complete. Execute participant claim now.';
  }
  if (ui.currentStep === 'settle') {
    return 'Event is closed. Trigger automated settlement.';
  }
  if (ui.currentStep === 'close') {
    return 'Proofs are in. Close the event to lock settlement scope.';
  }
  if (ui.currentStep === 'proofs') {
    return 'Event created. Collect Proof A and Proof B.';
  }
  return 'Ready to execute the settlement mission.';
}

function renderEvidenceDeck(ui) {
  el.evidenceProofA.textContent = summarizeProof('site-a');
  el.evidenceProofB.textContent = summarizeProof('site-b');

  const proofA = state.proofs['site-a'];
  const proofB = state.proofs['site-b'];
  const maxReduction = Math.max(
    Number(proofA?.reduction_kwh || 0),
    Number(proofB?.reduction_kwh || 0),
    1,
  );

  const reductionA = Number(proofA?.reduction_kwh || 0);
  const reductionB = Number(proofB?.reduction_kwh || 0);
  const pctA = Math.max(0, Math.min(100, Math.round((reductionA / maxReduction) * 100)));
  const pctB = Math.max(0, Math.min(100, Math.round((reductionB / maxReduction) * 100)));
  const baselineA = Number(proofA?.baseline_kwh || 0);
  const baselineB = Number(proofB?.baseline_kwh || 0);
  const ratioA = baselineA > 0 ? Math.round((reductionA / baselineA) * 100) : 0;
  const ratioB = baselineB > 0 ? Math.round((reductionB / baselineB) * 100) : 0;

  if (el.proofABar) el.proofABar.style.width = proofA ? `${pctA}%` : '0%';
  if (el.proofBBar) el.proofBBar.style.width = proofB ? `${pctB}%` : '0%';
  if (el.proofADelta) el.proofADelta.textContent = proofA ? `${formatNumber(reductionA)} kWh (${ratioA}%)` : '-';
  if (el.proofBDelta) el.proofBDelta.textContent = proofB ? `${formatNumber(reductionB)} kWh (${ratioB}%)` : '-';

  const auditRequested = state.judgeSummary?.audit_requested ?? !!state.audit;
  const auditMatch = state.judgeSummary?.audit_match ?? (state.audit ? !!state.audit.match : null);
  if (!auditRequested) {
    el.evidenceAuditResult.textContent = 'Audit result pending.';
    el.evidenceAuditHash.textContent = 'Hash: -';
  } else if (state.audit) {
    el.evidenceAuditResult.textContent = auditMatch
      ? 'Audit PASS: hash recomputation matches on-chain anchor.'
      : 'Audit MISMATCH: recomputed hash differs from on-chain anchor.';
    el.evidenceAuditHash.textContent = `Hash: ${shortHash(state.audit.proof_hash_onchain)} | ${shortHash(state.audit.proof_hash_recomputed)}`;
  } else {
    el.evidenceAuditResult.textContent = auditMatch
      ? 'Audit PASS: hash verification completed.'
      : 'Audit MISMATCH: check engineering evidence for details.';
    el.evidenceAuditHash.textContent = 'Hash: available in engineering mode logs.';
  }

  el.narrativeLine.textContent = buildNarrative(ui);
  const lastTransition = state.judgeSummary?.last_transition_at || state.lastTransitionAt;
  el.lastActionLine.textContent = `Last action: ${state.lastAction}${lastTransition ? ` | Last transition: ${lastTransition}` : ''}`;

  const insight = buildAgentInsight(ui);
  if (el.insightHeadline) el.insightHeadline.textContent = insight.headline;
  if (el.insightReason) el.insightReason.textContent = insight.reason;
  if (el.insightImpact) el.insightImpact.textContent = insight.impact;
  if (el.storyInsight) el.storyInsight.textContent = insight.story;
}

function renderErrorCard() {
  if (!el.errorCard) return;
  el.errorCard.dataset.level = state.errorView.level || 'ok';
  el.errorHeadline.textContent = state.errorView.headline;
  el.errorHint.textContent = state.errorView.hint;
  el.errorNext.textContent = state.errorView.next;
}

function renderStoryHero(ui) {
  if (!el.heroTitle || !el.heroSubtitle) return;
  const summary = state.judgeSummary;
  const activeStep = summary?.current_step || ui.currentStep;
  const totalReduction = summary?.total_reduction_kwh ?? getTotalReductionKwh();
  const totalPayout = summary?.total_payout_drt ?? ui.totalPayout;
  const auditRequested = summary?.audit_requested ?? !!state.audit;
  const auditMatch = summary?.audit_match ?? (state.audit ? !!state.audit.match : null);
  const insight = buildAgentInsight(ui);

  if (activeStep === 'completed') {
    el.heroTitle.textContent = 'Finalized: Closed loop complete';
    el.heroSubtitle.textContent = 'All core steps reached final state with settlement and audit evidence.';
  } else if (state.lastError) {
    el.heroTitle.textContent = `Awaiting user action: fix ${formatStepForSummary(endpointToStep(state.lastError) || activeStep)}`;
    el.heroSubtitle.textContent = 'A blocking error occurred. Follow diagnostics and retry the highlighted step.';
  } else if (activeStep === 'proofs') {
    el.heroTitle.textContent = 'Awaiting proof: collect both participant submissions';
    el.heroSubtitle.textContent = 'Proof coverage must reach 2/2 before closing the event.';
  } else if (activeStep === 'settle') {
    el.heroTitle.textContent = 'Awaiting settlement: execute payout calculation';
    el.heroSubtitle.textContent = 'Event scope is closed and ready for deterministic settlement.';
  } else if (activeStep === 'audit') {
    el.heroTitle.textContent = 'Awaiting audit: verify hash consistency';
    el.heroSubtitle.textContent = 'Run audit to prove recomputed payload hash equals on-chain anchor.';
  } else {
    el.heroTitle.textContent = `Awaiting user action: ${formatStepForSummary(activeStep)}`;
    el.heroSubtitle.textContent = insight.reason;
  }

  if (el.storyEnergy) el.storyEnergy.textContent = formatKwh(totalReduction);
  if (el.storyPayout) el.storyPayout.textContent = formatPayout(totalPayout);
  if (el.storyAudit) {
    if (!auditRequested) el.storyAudit.textContent = 'Pending';
    else el.storyAudit.textContent = auditMatch ? 'Pass' : 'Mismatch';
  }
}

function renderTechnicalEvidence() {
  if (state.viewMode === 'engineering') state.evidenceOpen = true;
  if (state.viewMode !== 'engineering' && !state.evidenceOpen) {
    el.technicalEvidence.classList.add('collapsed');
  } else {
    el.technicalEvidence.classList.toggle('collapsed', !state.evidenceOpen);
  }
  el.evidenceToggle.textContent = state.evidenceOpen ? 'Hide Technical Evidence' : 'View Technical Evidence';
  el.evidenceToggle.setAttribute('aria-expanded', String(state.evidenceOpen));
}

function applyActionGuards(ui) {
  const hasEvent = !!state.event;

  setButtonState('btnCreate', !state.busy, state.busy ? 'Action in progress.' : '');
  setButtonState(
    'btnProofA',
    !state.busy && hasEvent && !state.proofs['site-a'],
    !hasEvent ? 'Create event first.' : 'Proof A already submitted or action in progress.',
  );
  setButtonState(
    'btnProofB',
    !state.busy && hasEvent && !state.proofs['site-b'],
    !hasEvent ? 'Create event first.' : 'Proof B already submitted or action in progress.',
  );
  setButtonState(
    'btnClose',
    !state.busy && hasEvent && ui.proofsDone && !ui.closeDone,
    ui.proofsDone ? 'Event already closed or action in progress.' : 'Submit both proofs first.',
  );
  setButtonState(
    'btnSettle',
    !state.busy && hasEvent && ui.closeDone && !ui.settleDone,
    ui.closeDone ? 'Settlement already done or action in progress.' : 'Close event first.',
  );
  setButtonState(
    'btnClaimA',
    !state.busy && ui.settleDone && !ui.claimDone,
    ui.settleDone ? 'Claim already completed or action in progress.' : 'Settle event first.',
  );
  setButtonState('btnRunAll', !state.busy, state.busy ? 'Action in progress.' : '');
  setButtonState('btnRunAllHero', !state.busy, state.busy ? 'Action in progress.' : '');
  setButtonState(
    'btnNextStep',
    !state.busy && ui.currentStep !== 'completed',
    ui.currentStep === 'completed' ? 'Flow already completed.' : 'Action in progress.',
  );
  setButtonState('btnGetEvent', !state.busy && hasEvent, hasEvent ? 'Action in progress.' : 'Create event first.');
  setButtonState(
    'btnGetRecords',
    !state.busy && ui.settleDone,
    ui.settleDone ? 'Action in progress.' : 'Settle event first.',
  );
  setButtonState('btnAudit', !state.busy && hasEvent, hasEvent ? 'Action in progress.' : 'Create event first.');
}

function applyCameraMode(ui) {
  const stepNodes = Array.from(document.querySelectorAll('.step-pill'));
  const kpiNodes = Array.from(document.querySelectorAll('.kpi-card'));
  stepNodes.forEach((node) => node.classList.remove('camera-focus'));
  kpiNodes.forEach((node) => node.classList.remove('camera-focus'));

  if (!state.cameraMode) return;

  const targetStep = focusStepForCamera(ui);
  const targetKpi = focusKpiForCamera(ui);

  const stepNode = targetStep ? document.getElementById(`step-${targetStep}`) : null;
  if (stepNode) stepNode.classList.add('camera-focus');

  const kpiNode = targetKpi ? document.getElementById(`kpiCard${targetKpi.charAt(0).toUpperCase()}${targetKpi.slice(1)}`) : null;
  if (kpiNode) kpiNode.classList.add('camera-focus');
}

function toggleCameraMode() {
  state.cameraMode = !state.cameraMode;
  document.body.classList.toggle('camera-mode', state.cameraMode);
  localStorage.setItem('dr_camera_mode', state.cameraMode ? '1' : '0');
  if (el.btnCameraMode) {
    el.btnCameraMode.textContent = state.cameraMode ? 'Disable Camera Mode' : 'Enable Camera Mode';
    el.btnCameraMode.setAttribute('aria-pressed', String(state.cameraMode));
  }
  renderAll();
}

function toggleJudgeMode() {
  state.judgeMode = !state.judgeMode;
  document.body.classList.toggle('judge-mode', state.judgeMode);
  localStorage.setItem('dr_judge_mode', state.judgeMode ? '1' : '0');
  if (el.btnJudgeMode) {
    el.btnJudgeMode.textContent = state.judgeMode ? 'Disable Judge Mode' : 'Enable Judge Mode';
    el.btnJudgeMode.setAttribute('aria-pressed', String(state.judgeMode));
  }
}

function renderAll() {
  const ui = deriveUiState();
  renderViewMode();
  renderMissionStrip(ui);
  renderStoryHero(ui);
  renderFlowTimeline(ui);
  renderKpiGrid(ui);
  renderEvidenceDeck(ui);
  renderErrorCard();
  renderSnapshotFeedback();
  applyActionGuards(ui);
  applyCameraMode(ui);
  renderTechnicalEvidence();
}

function appendLog(label, payload) {
  const entry = `[${new Date().toISOString()}] ${label}\n${typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}`;
  state.logEntries.push(entry);
  const overflow = Math.max(0, state.logEntries.length - MAX_LOG_ENTRIES);
  if (overflow > 0) {
    state.logEntries.splice(0, overflow);
  }

  const prefix = overflow > 0 ? '[log] older entries trimmed for performance\n\n' : '';
  el.log.textContent = `${prefix}${state.logEntries.join('\n\n')}\n`;
  el.log.scrollTop = el.log.scrollHeight;
  state.lastAction = label;
  renderAll();
}

function plusMinutes(mins) {
  const d = new Date(Date.now() + mins * 60 * 1000);
  return d.toISOString().replace('.000', '');
}

async function callApi(path, method, body, apiKey, actorId = 'ui-user') {
  const start = performance.now();
  const { baseUrl } = cfg();
  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-actor-id': actorId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    state.lastLatencyMs = performance.now() - start;
  }

  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    // keep raw text
  }

  if (!response.ok) {
    const code = data && typeof data === 'object' && data.code ? data.code : response.status;
    throw new Error(`${method} ${path} failed: ${code}`);
  }

  return data;
}

async function refreshChainMode() {
  const c = cfg();
  try {
    const data = await callApi('/system/chain-mode', 'GET', null, c.auditorKey, 'auditor-1');
    state.chainMode = data.mode || 'unknown';
  } catch (_) {
    state.chainMode = 'unknown';
  } finally {
    renderAll();
  }
}

function resetForNewEvent() {
  state.proofs = {};
  state.settlements = [];
  state.audit = null;
  state.stepErrors = {};
  state.judgeSummary = null;
}

async function createEvent() {
  const c = cfg();
  const payload = {
    event_id: c.eventId,
    start_time: plusMinutes(1),
    end_time: plusMinutes(61),
    target_kw: 200,
    reward_rate: 10,
    penalty_rate: 5,
  };
  const data = await callApi('/events', 'POST', payload, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('create');
  resetForNewEvent();
  state.event = data;
  markTransition();
  await refreshJudgeSummary();
  appendLog('create event ok', data);
}

async function submitProof(siteId, baseline, actual) {
  const c = cfg();
  const payload = {
    event_id: c.eventId,
    site_id: siteId,
    baseline_kwh: baseline,
    actual_kwh: actual,
    uri: `ipfs://${siteId}-${Date.now()}`,
    raw_payload: { meter: [baseline, actual] },
    baseline_method: 'simple',
  };
  const data = await callApi('/proofs', 'POST', payload, c.participantKey, siteId);
  clearErrorState();
  clearStepError('proofs');
  state.proofs[siteId] = data;
  markTransition();
  await refreshJudgeSummary();
  appendLog(`submit proof ${siteId} ok`, data);
}

async function closeEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/close`, 'POST', null, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('close');
  state.event = data;
  markTransition();
  await refreshJudgeSummary();
  appendLog('close event ok', data);
}

async function settleEvent() {
  const c = cfg();
  const payload = { site_ids: ['site-a', 'site-b'] };
  const data = await callApi(`/settle/${c.eventId}`, 'POST', payload, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('settle');
  state.settlements = data;
  if (state.event) state.event.status = 'settled';
  markTransition();
  await refreshJudgeSummary();
  appendLog('settle ok', data);
}

async function claimA() {
  const c = cfg();
  const data = await callApi(`/claim/${c.eventId}/site-a`, 'POST', null, c.participantKey, 'site-a');
  clearErrorState();
  clearStepError('claim');
  const idx = state.settlements.findIndex((row) => row.site_id === data.site_id);
  if (idx >= 0) state.settlements[idx] = data;
  else state.settlements.push(data);
  markTransition();
  await refreshJudgeSummary();
  appendLog('claim site-a ok', data);
}

async function getEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  state.event = data;
  await refreshJudgeSummary();
  appendLog('event detail', data);
}

async function getRecords() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/records`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  state.settlements = data;
  await refreshJudgeSummary();
  appendLog('settlement records', data);
}

async function getAudit() {
  const c = cfg();
  const data = await callApi(`/audit/${c.eventId}/${c.auditSiteId}`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  clearStepError('audit');
  state.audit = data;
  markTransition();
  await refreshJudgeSummary();
  appendLog('audit record', data);
}

async function runFullFlow() {
  appendLog('run', `starting full flow for ${cfg().eventId}`);
  await createEvent();
  await submitProof('site-a', 150, 40);
  await submitProof('site-b', 150, 120);
  await closeEvent();
  await settleEvent();
  await claimA();
  await getEvent();
  await getRecords();
  await getAudit();
  appendLog('run', 'full flow completed');
}

async function runNextStep() {
  const ui = deriveUiState();

  if (ui.currentStep === 'create') {
    await createEvent();
    return;
  }
  if (ui.currentStep === 'proofs') {
    if (!state.proofs['site-a']) {
      await submitProof('site-a', 150, 40);
      return;
    }
    if (!state.proofs['site-b']) {
      await submitProof('site-b', 150, 120);
      return;
    }
    return;
  }
  if (ui.currentStep === 'close') {
    await closeEvent();
    return;
  }
  if (ui.currentStep === 'settle') {
    await settleEvent();
    return;
  }
  if (ui.currentStep === 'claim') {
    await claimA();
    return;
  }
  if (ui.currentStep === 'audit') {
    await getAudit();
  }
}

function triggerButton(id) {
  const node = document.getElementById(id);
  if (!node || node.disabled) return;
  node.click();
}

function handleActionError(err, fallbackStep) {
  const message = err.message || String(err);
  state.lastError = message;
  state.errorView = decodeError(message);
  const step = endpointToStep(message) || fallbackStep;
  if (step) {
    state.stepErrors[step] = message;
    state.errorView.next = `Failed step: ${stepLabel(step)}. Retry suggestion: ${state.errorView.next}`;
  }
  appendLog('error', message);
}

function bindAction(id, fn, fallbackStep = '') {
  const node = document.getElementById(id);
  if (!node) return;
  node.addEventListener('click', async () => {
    if (state.busy) return;
    state.busy = true;
    renderAll();
    try {
      await fn();
    } catch (err) {
      handleActionError(err, fallbackStep);
    } finally {
      state.busy = false;
      renderAll();
    }
  });
}

if (el.evidenceToggle) {
  el.evidenceToggle.addEventListener('click', () => {
    state.evidenceOpen = !state.evidenceOpen;
    renderTechnicalEvidence();
  });
}

if (el.btnViewStory) {
  el.btnViewStory.addEventListener('click', () => {
    applyViewMode('story');
    renderAll();
  });
}

if (el.btnViewOps) {
  el.btnViewOps.addEventListener('click', () => {
    applyViewMode('ops');
    renderAll();
  });
}

if (el.btnViewEngineering) {
  el.btnViewEngineering.addEventListener('click', () => {
    applyViewMode('engineering');
    renderAll();
  });
}

if (el.btnTheme) {
  el.btnTheme.addEventListener('click', toggleTheme);
}

if (el.btnExportSnapshot) {
  el.btnExportSnapshot.addEventListener('click', async () => {
    await exportJudgeSnapshot();
  });
}

if (el.btnCameraMode) {
  el.btnCameraMode.addEventListener('click', toggleCameraMode);
}

if (el.btnJudgeMode) {
  el.btnJudgeMode.addEventListener('click', toggleJudgeMode);
}

if (el.builderPanel) {
  el.builderPanel.addEventListener('toggle', () => {
    state.builderOpen = el.builderPanel.open;
    localStorage.setItem('dr_builder_open', state.builderOpen ? '1' : '0');
  });
}

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('input, textarea, select')) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    triggerButton('btnNextStep');
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    triggerButton('btnRunAllHero');
  } else if (event.key === 'e' || event.key === 'E') {
    event.preventDefault();
    applyViewMode('engineering');
    renderAll();
  }
});

activateTab('control');
applyViewMode(state.viewMode);

bindAction('btnCreate', createEvent, 'create');
bindAction('btnProofA', () => submitProof('site-a', 150, 40), 'proofs');
bindAction('btnProofB', () => submitProof('site-b', 150, 120), 'proofs');
bindAction('btnClose', closeEvent, 'close');
bindAction('btnSettle', settleEvent, 'settle');
bindAction('btnClaimA', claimA, 'claim');
bindAction('btnRunAll', runFullFlow, 'create');
bindAction('btnRunAllHero', runFullFlow, 'create');
bindAction('btnNextStep', runNextStep, 'create');
bindAction('btnGetEvent', getEvent, 'create');
bindAction('btnGetRecords', getRecords, 'settle');
bindAction('btnAudit', getAudit, 'audit');

renderAll();
appendLog('ready', 'DR Agent Mission Cockpit initialized');
refreshChainMode();
refreshJudgeSummary();
