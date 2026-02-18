const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = {
  control: document.getElementById('tab-control'),
  event: document.getElementById('tab-event'),
  audit: document.getElementById('tab-audit'),
};

const logEl = document.getElementById('log');
const eventIdInput = document.getElementById('eventId');

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
  appendLog(`submit proof ${siteId} ok`, data);
}

async function settleEvent() {
  const c = cfg();
  const payload = { site_ids: ['site-a', 'site-b'] };
  const data = await callApi(`/settle/${c.eventId}`, 'POST', payload, c.operatorKey, 'operator-1');
  appendLog('settle ok', data);
}

async function closeEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/close`, 'POST', null, c.operatorKey, 'operator-1');
  appendLog('close event ok', data);
}

async function claimA() {
  const c = cfg();
  const data = await callApi(`/claim/${c.eventId}/site-a`, 'POST', null, c.participantKey, 'site-a');
  appendLog('claim site-a ok', data);
}

async function getEvent() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}`, 'GET', null, c.auditorKey, 'auditor-1');
  appendLog('event detail', data);
}

async function getRecords() {
  const c = cfg();
  const data = await callApi(`/events/${c.eventId}/records`, 'GET', null, c.auditorKey, 'auditor-1');
  appendLog('settlement records', data);
}

async function getAudit() {
  const c = cfg();
  const data = await callApi(`/audit/${c.eventId}/${c.auditSiteId}`, 'GET', null, c.auditorKey, 'auditor-1');
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
      appendLog('error', err.message || String(err));
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

appendLog('ready', 'DR Agent Demo Console initialized');
