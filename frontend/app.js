const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = {
  control: document.getElementById('tab-control'),
  event: document.getElementById('tab-event'),
  audit: document.getElementById('tab-audit'),
};

const logEl = document.getElementById('log');
const eventIdInput = document.getElementById('eventId');
const metricEventId = document.getElementById('metricEventId');
const metricEventStatus = document.getElementById('metricEventStatus');
const metricProofCoverage = document.getElementById('metricProofCoverage');
const metricTotalPayout = document.getElementById('metricTotalPayout');
const metricClaimStatus = document.getElementById('metricClaimStatus');
const metricAuditMatch = document.getElementById('metricAuditMatch');
const proofHumanA = document.getElementById('proofHumanA');
const proofHumanB = document.getElementById('proofHumanB');
const narrativeLine = document.getElementById('narrativeLine');
const lastActionLine = document.getElementById('lastActionLine');

const state = {
  event: null,
  proofs: {},
  settlements: [],
  audit: null,
  lastAction: 'none',
  lastError: '',
};

if (!eventIdInput.value) {
  eventIdInput.value = `event-ui-${Date.now()}`;
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    const key = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
    Object.entries(panels).forEach(([name, panel]) => {
      panel.classList.toggle('hidden', name !== key);
    });
  });
}

function cfg() {
  return {
    baseUrl: document.getElementById('baseUrl').value.trim(),
    eventId: eventIdInput.value.trim(),
    operatorKey: document.getElementById('operatorKey').value.trim(),
    participantKey: document.getElementById('participantKey').value.trim(),
    auditorKey: document.getElementById('auditorKey').value.trim(),
    auditSiteId: document.getElementById('auditSiteId').value.trim() || 'site-a',
  };
}

function appendLog(label, payload) {
  const line = `[${new Date().toISOString()}] ${label}\n${typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}\n`;
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
  state.lastAction = label;
  renderJudgeView();
}

function fmtNum(value) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('en-US');
}

function stepDone(id, done) {
  const el = document.getElementById(`step-${id}`);
  if (!el) return;
  el.classList.toggle('done', done);
  if (done) el.classList.remove('error');
}

function clearStepErrors() {
  const steps = ['create', 'proofs', 'close', 'settle', 'claim', 'audit'];
  for (const step of steps) {
    const el = document.getElementById(`step-${step}`);
    if (el) el.classList.remove('error');
  }
}

function markStepError(message) {
  clearStepErrors();
  let step = '';
  if (message.includes('/proofs')) step = 'proofs';
  else if (message.includes('/close')) step = 'close';
  else if (message.includes('/settle')) step = 'settle';
  else if (message.includes('/claim')) step = 'claim';
  else if (message.includes('/audit')) step = 'audit';
  else if (message.includes('POST /events')) step = 'create';
  if (!step) return;
  const el = document.getElementById(`step-${step}`);
  if (el) el.classList.add('error');
}

function proofSummaryText(siteId) {
  const proof = state.proofs[siteId];
  if (!proof) return `Proof ${siteId === 'site-a' ? 'A' : 'B'}（${siteId}）：尚未提交。`;
  return `Proof ${siteId === 'site-a' ? 'A' : 'B'}（${siteId}）：baseline ${proof.baseline_kwh}，actual ${proof.actual_kwh}，reduction ${proof.reduction_kwh}。`;
}

function renderJudgeView() {
  if (!metricEventId) return;

  metricEventId.textContent = state.event?.event_id || cfg().eventId || '-';
  metricEventStatus.textContent = state.event?.status || 'Not started';

  const proofCount = Object.keys(state.proofs).length;
  metricProofCoverage.textContent = `${proofCount} / 2 sites`;

  const totalPayout = state.settlements.reduce((sum, item) => sum + (item.payout || 0), 0);
  metricTotalPayout.textContent = fmtNum(totalPayout);

  const claimA = state.settlements.find((x) => x.site_id === 'site-a');
  metricClaimStatus.textContent = claimA?.status || 'Pending';

  if (!state.audit) metricAuditMatch.textContent = 'Pending';
  else metricAuditMatch.textContent = state.audit.match ? 'PASS' : 'MISMATCH';

  proofHumanA.textContent = proofSummaryText('site-a');
  proofHumanB.textContent = proofSummaryText('site-b');

  const createDone = !!state.event;
  const proofsDone = !!state.proofs['site-a'] && !!state.proofs['site-b'];
  const closeDone = ['closed', 'settled'].includes(state.event?.status || '');
  const settleDone = state.settlements.length > 0;
  const claimDone = claimA?.status === 'claimed';
  const auditDone = !!state.audit;

  stepDone('create', createDone);
  stepDone('proofs', proofsDone);
  stepDone('close', closeDone);
  stepDone('settle', settleDone);
  stepDone('claim', claimDone);
  stepDone('audit', auditDone);

  if (state.lastError) {
    narrativeLine.textContent = `错误：${state.lastError}`;
  } else if (auditDone && claimDone) {
    narrativeLine.textContent = '闭环完成：结果可结算、可领取、可审计。';
  } else if (settleDone) {
    narrativeLine.textContent = '已完成自动结算，正在进入领取与审计阶段。';
  } else if (proofsDone) {
    narrativeLine.textContent = '两份 proof 已提交，等待 close 后结算。';
  } else if (createDone) {
    narrativeLine.textContent = '事件已创建，等待站点提交 proof。';
  } else {
    narrativeLine.textContent = 'Ready to run demo flow.';
  }

  lastActionLine.textContent = `Last action: ${state.lastAction}`;
}

function plusMinutes(mins) {
  const d = new Date(Date.now() + mins * 60 * 1000);
  return d.toISOString().replace('.000', '');
}

async function callApi(path, method, body, apiKey, actorId = 'ui-user') {
  const { baseUrl } = cfg();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-actor-id': actorId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    // keep raw text
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
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
  state.lastError = '';
  state.event = data;
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
  state.lastError = '';
  state.proofs[siteId] = data;
  appendLog(`submit proof ${siteId} ok`, data);
}

async function settleEvent() {
  const c = cfg();
  const payload = { site_ids: ['site-a', 'site-b'] };
  const data = await callApi(`/settle/${c.eventId}`, 'POST', payload, c.operatorKey, 'operator-1');
  state.lastError = '';
  state.settlements = data;
  if (state.event) state.event.status = 'settled';
  appendLog('settle ok', data);
}

async function closeEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/close`, 'POST', null, c.operatorKey, 'operator-1');
  state.lastError = '';
  state.event = data;
  appendLog('close event ok', data);
}

async function claimA() {
  const c = cfg();
  const data = await callApi(`/claim/${c.eventId}/site-a`, 'POST', null, c.participantKey, 'site-a');
  state.lastError = '';
  const idx = state.settlements.findIndex((x) => x.site_id === data.site_id);
  if (idx >= 0) state.settlements[idx] = data;
  else state.settlements.push(data);
  appendLog('claim site-a ok', data);
}

async function getEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}`, 'GET', null, c.auditorKey, 'auditor-1');
  state.lastError = '';
  state.event = data;
  appendLog('event detail', data);
}

async function getRecords() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/records`, 'GET', null, c.auditorKey, 'auditor-1');
  state.lastError = '';
  state.settlements = data;
  appendLog('settlement records', data);
}

async function getAudit() {
  const c = cfg();
  const data = await callApi(`/audit/${c.eventId}/${c.auditSiteId}`, 'GET', null, c.auditorKey, 'auditor-1');
  state.lastError = '';
  state.audit = data;
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

function bind(id, fn) {
  document.getElementById(id).addEventListener('click', async () => {
    try {
      await fn();
    } catch (err) {
      const message = err.message || String(err);
      state.lastError = message;
      markStepError(message);
      appendLog('error', message);
    }
  });
}

bind('btnCreate', createEvent);
bind('btnProofA', () => submitProof('site-a', 150, 40));
bind('btnProofB', () => submitProof('site-b', 150, 120));
bind('btnClose', closeEvent);
bind('btnSettle', settleEvent);
bind('btnClaimA', claimA);
bind('btnRunAll', runFullFlow);
bind('btnGetEvent', getEvent);
bind('btnGetRecords', getRecords);
bind('btnAudit', getAudit);

renderJudgeView();
appendLog('ready', 'DR Agent Demo Console initialized');
