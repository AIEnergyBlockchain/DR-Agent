const FLOW_STEPS = [
  { id: 'create', label: 'Create' },
  { id: 'proofs', label: 'Proofs' },
  { id: 'close', label: 'Close' },
  { id: 'settle', label: 'Settle' },
  { id: 'claim', label: 'Claim' },
  { id: 'audit', label: 'Audit' },
];
const VIEW_MODES = ['story', 'engineering'];
const DEFAULT_REQUIRED_PROOF_SITES = ['site-a', 'site-b'];

const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = {
  control: document.getElementById('tab-control'),
  event: document.getElementById('tab-event'),
  audit: document.getElementById('tab-audit'),
  crosschain: document.getElementById('tab-crosschain'),
};
const TAB_ORDER = ['control', 'event', 'audit', 'crosschain'];
const MAX_LOG_ENTRIES = 320;
const MAX_STEP_TIMING_ENTRIES = 24;
const PENDING_TX_WAIT_TIMEOUT_MS = 120000;
const PENDING_TX_POLL_MS = 1200;
const HERO_TITLE_MAX_CHARS = 55;
const HERO_SUBTITLE_MAX_CHARS = 90;

const el = {
  log: document.getElementById('log'),
  btnViewStory: document.getElementById('btnViewStory'),
  btnViewEngineering: document.getElementById('btnViewEngineering'),
  btnLangEn: document.getElementById('btnLangEn'),
  btnLangZh: document.getElementById('btnLangZh'),
  modeHint: document.getElementById('modeHint'),
  builderPanel: document.getElementById('builderPanel'),
  btnTheme: document.getElementById('btnTheme'),
  btnCameraMode: document.getElementById('btnCameraMode'),
  btnNextStep: document.getElementById('btnNextStep'),
  btnRunAllHero: document.getElementById('btnRunAllHero'),
  btnExportSnapshot: document.getElementById('btnExportSnapshot'),
  btnStoryTechEvidence: document.getElementById('btnStoryTechEvidence'),
  btnStorySnapshot: document.getElementById('btnStorySnapshot'),
  snapshotFeedback: document.getElementById('snapshotFeedback'),
  storyEvidenceHint: document.getElementById('storyEvidenceHint'),
  storyLatestTxLine: document.getElementById('storyLatestTxLine'),
  storyLatestTxLink: document.getElementById('storyLatestTxLink'),
  storyAgentInsight: document.getElementById('storyAgentInsight'),
  storyInsightSkeleton: document.getElementById('storyInsightSkeleton'),
  storyInsightContent: document.getElementById('storyInsightContent'),
  storyInsightHeadline: document.getElementById('storyInsightHeadline'),
  storyInsightReason: document.getElementById('storyInsightReason'),
  storyInsightImpact: document.getElementById('storyInsightImpact'),
  storyInsightMeta: document.getElementById('storyInsightMeta'),
  storyConfidenceBar: document.getElementById('storyConfidenceBar'),
  storyConfidencePct: document.getElementById('storyConfidencePct'),
  storyRiskFlags: document.getElementById('storyRiskFlags'),
  storyDataPoints: document.getElementById('storyDataPoints'),
  storySuggestedAction: document.getElementById('storySuggestedAction'),
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
  storyLatencyLine: document.getElementById('storyLatencyLine'),
  storyEnergy: document.getElementById('storyEnergy'),
  storyPayout: document.getElementById('storyPayout'),
  storyAudit: document.getElementById('storyAudit'),
  storyChallenge: document.getElementById('storyChallenge'),
  storyInsight: document.getElementById('storyInsight'),
  visualInsights: document.getElementById('visualInsights'),
  visualEmpty: document.getElementById('visualEmpty'),
  visualEmptyText: document.getElementById('visualEmptyText'),
  visualGrid: document.getElementById('visualGrid'),
  visSiteABaselineBar: document.getElementById('visSiteABaselineBar'),
  visSiteAActualBar: document.getElementById('visSiteAActualBar'),
  visSiteBBaselineBar: document.getElementById('visSiteBBaselineBar'),
  visSiteBActualBar: document.getElementById('visSiteBActualBar'),
  visSiteABaselineText: document.getElementById('visSiteABaselineText'),
  visSiteAActualText: document.getElementById('visSiteAActualText'),
  visSiteBBaselineText: document.getElementById('visSiteBBaselineText'),
  visSiteBActualText: document.getElementById('visSiteBActualText'),
  visSiteAReduction: document.getElementById('visSiteAReduction'),
  visSiteBReduction: document.getElementById('visSiteBReduction'),
  visPayoutSiteABar: document.getElementById('visPayoutSiteABar'),
  visPayoutSiteBBar: document.getElementById('visPayoutSiteBBar'),
  visPayoutSiteAValue: document.getElementById('visPayoutSiteAValue'),
  visPayoutSiteBValue: document.getElementById('visPayoutSiteBValue'),
  visualConfidenceWeight: document.getElementById('visualConfidenceWeight'),
  visualConfidenceMethod: document.getElementById('visualConfidenceMethod'),

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
  insightCard: document.getElementById('insightCard'),
  insightSkeleton: document.getElementById('insightSkeleton'),
  insightContent: document.getElementById('insightContent'),
  insightHeadline: document.getElementById('insightHeadline'),
  insightReason: document.getElementById('insightReason'),
  insightImpact: document.getElementById('insightImpact'),
  insightMeta: document.getElementById('insightMeta'),
  confidenceBar: document.getElementById('confidenceBar'),
  confidencePct: document.getElementById('confidencePct'),
  riskFlags: document.getElementById('riskFlags'),
  insightDataPoints: document.getElementById('insightDataPoints'),
  suggestedAction: document.getElementById('suggestedAction'),
  anomalyCard: document.getElementById('anomalyCard'),
  anomalyBadge: document.getElementById('anomalyBadge'),
  anomalyType: document.getElementById('anomalyType'),
  anomalyDescription: document.getElementById('anomalyDescription'),
  anomalyRecommendation: document.getElementById('anomalyRecommendation'),
  anomalyAffectedList: document.getElementById('anomalyAffectedList'),
  agentStatusDot: document.getElementById('agentStatusDot'),
  agentStatusLabel: document.getElementById('agentStatusLabel'),
  errorCard: document.getElementById('errorCard'),
  errorHeadline: document.getElementById('errorHeadline'),
  errorHint: document.getElementById('errorHint'),
  errorNext: document.getElementById('errorNext'),
  evidenceToggle: document.getElementById('evidenceToggle'),
  technicalEvidence: document.getElementById('technicalEvidence'),
  missionBridgeStatus: document.getElementById('missionBridgeStatus'),
  missionICMStatus: document.getElementById('missionICMStatus'),
  bridgeTransfersBody: document.getElementById('bridgeTransfersBody'),
  icmMessagesBody: document.getElementById('icmMessagesBody'),
  bridgeStatsTotal: document.getElementById('bridgeStatsTotal'),
  bridgeStatsPending: document.getElementById('bridgeStatsPending'),
  bridgeStatsCompleted: document.getElementById('bridgeStatsCompleted'),
  icmStatsTotal: document.getElementById('icmStatsTotal'),
  icmStatsPending: document.getElementById('icmStatsPending'),
  btnRefreshCrosschain: document.getElementById('btnRefreshCrosschain'),
  storyCcBridgeValue: document.getElementById('storyCcBridgeValue'),
  storyCcIcmValue: document.getElementById('storyCcIcmValue'),
  storyCcBridgeTotal: document.getElementById('storyCcBridgeTotal'),
  storyCcIcmTotal: document.getElementById('storyCcIcmTotal'),
  storyCcHint: document.getElementById('storyCcHint'),
  baselineMockPreview: document.getElementById('baselineMockPreview'),
};

const I18N = {
  en: {
    'page.title': 'DR Agent Mission Cockpit',
    'hero.eyebrow': 'Protocol Demo | Execution Review',
    'hero.title': 'DR Agent Mission Cockpit',
    'hero.subtitle': 'Verifiable automated settlement for demand response events.',
    'mission.event': 'Event',
    'mission.chainMode': 'Chain Mode',
    'mission.currentStep': 'Current Step',
    'mission.health': 'Health',
    'mission.latency': 'Latency',
    'mission.flowProgress': 'Flow Progress',
    'mode.experience': 'Experience mode',
    'mode.story': 'Story Mode',
    'mode.engineering': 'Engineering Mode',
    'mode.hint.story': 'Story Mode is the judge-facing single-screen narrative.',
    'mode.hint.engineering': 'Engineering Mode exposes flow detail, diagnostics, and raw evidence.',
    'lang.en': 'EN',
    'lang.zh': '中文',
    'story.command': 'Mission Command',
    'story.energyReduction': 'Energy Reduction',
    'story.totalPayout': 'Total Payout',
    'story.auditConfidence': 'Audit Confidence',
    'story.challengeStatus': 'Challenge Status',
    'story.agentThinking': 'Agent Thinking',
    'story.viewTxEvidence': 'View Tx Evidence',
    'story.evidenceHint': 'Open engineering evidence or copy a review snapshot.',
    'story.agentInsightHint': 'Live signal from the on-chain agent, with confidence and risk flags.',
    'story.latestTxLabel': 'Latest Tx',
    'story.latestTxNone': 'No transaction yet',
    'story.latency.idle': 'Delay: waiting for first API call.',
    'story.latency.running': 'Delay: running {step} | elapsed {elapsed} | API {api}.',
    'story.latency.breakdown': 'Delay: {step} => API {api} + {summary} = {total}; {pending}.',
    'story.latency.pendingOnly': 'Delay: waiting confirmations for {count} pending tx.',
    'visual.title': 'Visual Insights',
    'visual.subtitle': 'Charts appear as proof and settlement data arrives.',
    'visual.empty': 'Run proof submission to unlock baseline and payout charts.',
    'visual.comparisonTitle': 'Submitted vs Baseline',
    'visual.payoutTitle': 'Payout Breakdown',
    'visual.confidenceWeight': 'Confidence Weight',
    'visual.confidenceMethod': 'Method',
    'visual.baseline': 'Baseline',
    'visual.actual': 'Actual',
    'visual.pending': 'Pending',
    'visual.reduction': 'Reduction',
    'action.next': 'Execute Next Step',
    'action.runAll': 'Auto Run Full Flow',
    'builder.mode': 'Builder Mode',
    'builder.apiControlKeys': 'API Control / Keys',
    'builder.apiControl': 'API Control',
    'builder.baseUrl': 'Base URL',
    'builder.eventId': 'Event ID',
    'builder.operatorKey': 'Operator Key',
    'builder.participantKey': 'Participant Key',
    'builder.auditorKey': 'Auditor Key',
    'builder.hint': 'If API runs with `make api-run`, ensure keys match your external secrets values.',
    'tabs.missionPanels': 'Mission panels',
    'tab.control': 'Control',
    'tab.event': 'Event',
    'tab.audit': 'Audit',
    'flow.controls': 'Flow Controls',
    'flow.createBtn': '1. Create Event',
    'flow.proofABtn': '2. Submit Proof A',
    'flow.proofBBtn': '3. Submit Proof B',
    'flow.closeBtn': '4. Close Event',
    'flow.settleBtn': '5. Settle',
    'flow.claimBtn': '6. Claim A',
    'flow.runAllBtn': 'Run Full Flow',
    'flow.pathHint': 'Primary story path: Create -> Proofs -> Close -> Settle -> Claim -> Audit.',
    'judge.title': 'Execution View',
    'judge.subtitle': 'Three-layer readout: mission context, KPI outcomes, execution evidence.',
    'step.create': 'Create',
    'step.proofs': 'Proofs',
    'step.close': 'Close',
    'step.settle': 'Settle',
    'step.claim': 'Claim',
    'step.audit': 'Audit',
    'step.completed': 'Completed',
    'kpi.status': 'Status',
    'kpi.coverage': 'Proof Coverage',
    'kpi.totalPayout': 'Total Payout',
    'kpi.claimA': 'Claim (site-a)',
    'kpi.auditMatch': 'Audit Match',
    'kpi.latency': 'Latency',
    'evidence.proofCompare': 'Proof A vs Proof B',
    'evidence.proofAReduction': 'Proof A Reduction',
    'evidence.proofBReduction': 'Proof B Reduction',
    'evidence.auditAnchor': 'Audit Anchor',
    'evidence.oneLineStory': 'One-Line Story',
    'evidence.agentInsight': 'Agent Insight',
    'evidence.executionDiagnostics': 'Execution Diagnostics',
    'evidence.toggleOpen': 'View Technical Evidence',
    'evidence.toggleClose': 'Hide Technical Evidence',
    'query.event': 'Event Query',
    'query.audit': 'Audit Query',
    'query.siteId': 'Site ID',
    'query.getEvent': 'Get Event',
    'query.getRecords': 'Get Settlement Records',
    'query.getAudit': 'Get Audit Record',
    'snapshot.copyJudge': 'Copy Snapshot',
    'snapshot.copyEngineer': 'Copy Engineer Snapshot',
    'snapshot.copiedJudge': 'Snapshot copied to clipboard.',
    'snapshot.copiedEngineer': 'Engineer snapshot copied to clipboard.',
    'snapshot.fallback': 'Clipboard unavailable. Snapshot was written to Technical Evidence.',
    'snapshot.title': 'DR Agent - Execution Snapshot',
    'snapshot.generated': 'Generated',
    'snapshot.theme': 'Theme',
    'snapshot.progress': 'Progress',
    'technical.title': 'Technical Evidence',
    'technical.subtitle': 'Raw JSON logs for engineering verification.',
    'theme.cobalt': 'Theme: Cobalt',
    'theme.neon': 'Theme: Neon',
    'camera.enable': 'Enable Camera Mode',
    'camera.disable': 'Disable Camera Mode',
    'status.pending': 'pending',
    'status.in-progress': 'in-progress',
    'status.done': 'done',
    'status.error': 'error',
    'status.active': 'active',
    'status.closed': 'closed',
    'status.settled': 'settled',
    'status.claimed': 'claimed',
    'status.submitted': 'submitted',
    'status.confirmed': 'confirmed',
    'status.failed': 'failed',
    'status.completed': 'completed',
    'status.verified': 'verified',
    'status.pass': 'PASS',
    'status.mismatch': 'mismatch',
    'status.read': 'read',
    'challenge.pending': 'pending',
    'challenge.review': 'in review',
    'challenge.accepted': 'accepted',
    'challenge.challenged': 'challenged',
    'network.fuji': 'Fuji Testnet',
    'network.fuji-live': 'Fuji Testnet (Live Tx)',
    'network.mainnet': 'Mainnet',
    'network.simulated': 'Simulation',
    'network.local': 'Local Devnet',
    'label.participantA': 'Participant A',
    'label.participantB': 'Participant B',
    'label.hash': 'Hash',
    'label.noWrites': 'no writes yet',
    'label.noTxHash': 'no tx hash',
    'label.none': 'none',
    'label.lastAction': 'Last action',
    'label.lastTransition': 'Last transition',
    'label.txPipeline': 'Tx',
    'diag.none.headline': 'No active errors.',
    'diag.none.hint': 'Flow guards prevent most invalid actions.',
    'diag.none.next': 'Next: run the current highlighted step.',
    'diag.waitingConfirm.headline': 'Waiting for asynchronous chain confirmations.',
    'diag.waitingConfirm.hint': '{count} transaction(s) are submitted and will backfill fee/confirmation.',
    'diag.waitingConfirm.next': 'Confirm mode {mode}. Continue flow; confirmations appear in refresh.',
    'diag.running.headline': 'Running {step}...',
    'diag.running.hint': '{phase}',
    'diag.running.next': 'Elapsed {elapsed} | API {api} | Confirm mode {mode}',
    'diag.delayBreakdown.headline': 'Delay breakdown: {step}{path}',
    'diag.delayBreakdown.hint': 'API {api} + {summary} = total {total}.',
    'diag.delayBreakdown.summaryDeferred': 'deferred summary refresh',
    'diag.delayBreakdown.summary': 'summary {summary}',
    'diag.delayBreakdown.next': 'Last step total {total} (api {api}, {summaryPart}); tx {tx}. {pendingPart}',
    'diag.delayBreakdown.pending': 'Pending confirmations: {count}.',
    'diag.delayBreakdown.failed': 'Failed confirmations: {count}.',
    'diag.delayBreakdown.nonePending': 'No pending tx confirmations.',
    'error.settleBlocked.headline': 'Settle blocked: event is not closed.',
    'error.settleBlocked.hint': 'The protocol requires closing the event before settlement.',
    'error.settleBlocked.next': 'Next: click "4. Close Event", then retry settle.',
    'error.duplicate.headline': 'Duplicate operation rejected.',
    'error.duplicate.hint': 'This step appears to be already completed for the current event.',
    'error.duplicate.next': 'Next: move to the next highlighted step.',
    'error.auth.headline': 'Authorization failed.',
    'error.auth.hint': 'API keys or actor permissions do not match backend expectations.',
    'error.auth.next': 'Next: verify Operator / Participant / Auditor keys in Builder Mode.',
    'error.pendingChain.headline': 'Previous on-chain step is still pending confirmation.',
    'error.pendingChain.hint': 'Hybrid mode returns tx hash immediately. Dependent actions may fail until prior tx is mined.',
    'error.pendingChain.next': 'Next: wait a few seconds and retry, or switch to sync confirm mode for strict sequencing.',
    'error.pendingChain.timeoutHint': 'Waited {seconds}s but pending tx is still not confirmed.',
    'error.actionFailed.headline': 'Action failed.',
    'error.actionFailed.next': 'Next: follow the highlighted step and retry.',
    'error.failedStepPrefix': 'Failed step',
    'error.retrySuggestion': 'Retry suggestion',
    'hint.actionInProgress': 'Action in progress.',
    'hint.proofANotRequired': 'Proof A not required in current demo site mode.',
    'hint.proofBNotRequired': 'Proof B not required in current demo site mode.',
    'hint.createEventFirst': 'Create event first.',
    'hint.proofAAlready': 'Proof A already submitted or action in progress.',
    'hint.proofBAlready': 'Proof B already submitted or action in progress.',
    'hint.submitProofsFirst': 'Submit required proofs first.',
    'hint.eventClosedOrBusy': 'Event already closed or action in progress.',
    'hint.closeEventFirst': 'Close event first.',
    'hint.settlementDoneOrBusy': 'Settlement already done or action in progress.',
    'hint.settleFirst': 'Settle event first.',
    'hint.claimDoneOrBusy': 'Claim already completed or action in progress.',
    'hint.flowCompleted': 'Flow already completed.',
    'hint.auditPending': 'Audit endpoint not called yet.',
    'hint.proofsWaiting': 'Waiting for required proofs: {participants}.',
    'hint.proofsRegistered': 'Required participant proofs are registered.',
    'hint.payoutAfterSettlement': 'Payout appears after settlement execution.',
    'hint.payoutSum': 'Sum of all settlement records for this event (DRT).',
    'hint.claimPending': 'Participant A claim not finalized yet.',
    'hint.claimDone': 'Participant A claim is complete.',
    'hint.auditPass': 'On-chain hash matches recomputed hash.',
    'hint.auditMismatch': 'Hash mismatch detected. Investigate payload integrity.',
    'hint.apiRoundTrip': 'Latest API round-trip from browser.',
    'hint.eventPending': 'Create an event to start the mission.',
    'hint.eventActive': 'Event is active and accepting proofs.',
    'hint.eventClosed': 'Event is closed and ready for settlement.',
    'hint.eventSettled': 'Settlement finalized at protocol layer.',
    'hint.txPipeline': 'Tx pipeline: {pipeline}.',
    'narrative.default': 'Ready to execute the settlement mission.',
    'narrative.completed': 'Closed loop complete: settleable, claimable, auditable.',
    'narrative.audit': 'Claims are complete. Run audit to verify hash consistency.',
    'narrative.claim': 'Settlement complete. Execute participant claim now.',
    'narrative.settle': 'Event is closed. Trigger automated settlement.',
    'narrative.close': 'Proofs are in. Close the event to lock settlement scope.',
    'narrative.proofs': 'Event created. Collect required proofs ({participants}).',
    'narrative.error': '{step} failed: {message}',
    'audit.pending': 'Audit result pending.',
    'audit.pass': 'Audit PASS: hash recomputation matches on-chain anchor.',
    'audit.mismatch': 'Audit MISMATCH: recomputed hash differs from on-chain anchor.',
    'audit.passNoRecord': 'Audit PASS: hash verification completed.',
    'audit.mismatchNoRecord': 'Audit MISMATCH: check engineering evidence for details.',
    'audit.hashInLogs': 'Hash: available in engineering mode logs.',
    'proof.notSubmitted': 'Proof {tag} ({site}): not submitted.',
    'proof.summary': 'Proof {tag} ({site}): baseline {baseline}, actual {actual}, reduction {reduction}.',
    'insight.error.headline': 'Execution risk detected.',
    'insight.error.reason': 'Blocking issue at {step}. Resolve and retry.',
    'insight.error.impact': 'Impact: payout finality delayed until the blocking step is resolved.',
    'insight.error.story': 'Agent paused due to execution risk; operator action required.',
    'insight.txFailed.headline': 'Chain confirmation failure detected.',
    'insight.txFailed.reason': 'Tx pipeline reports {count} failed transaction(s).',
    'insight.txFailed.impact': 'Impact: retry the failed on-chain step before trusting payout finality.',
    'insight.txFailed.story': 'On-chain failure detected; operator retry required.',
    'insight.txSubmitted.headline': 'Transactions submitted to chain.',
    'insight.txSubmitted.reason': '{count} tx pending confirmation ({mode} mode).',
    'insight.txSubmitted.impact': 'Impact: flow can continue; fee and final confirmation are backfilled asynchronously.',
    'insight.txSubmitted.story': 'Tx broadcast complete; waiting for confirmation.',
    'insight.noEvent.headline': 'No event yet.',
    'insight.noEvent.reason': 'Agent needs an event window to anchor proof collection and settlement policy.',
    'insight.noEvent.impact': 'Impact: no measurable payout or audit evidence exists yet.',
    'insight.noEvent.story': 'Waiting for mission data.',
    'insight.proofs.headline': 'Collecting participant proofs.',
    'insight.proofs.reason': 'Coverage is {coverage}; required proofs: {participants}.',
    'insight.proofs.impact': 'Impact: payout model remains provisional until proof coverage is complete.',
    'insight.proofs.story': 'Awaiting proof submissions from both participants.',
    'insight.close.headline': 'Ready to close scope.',
    'insight.close.reason': 'Observed reduction {reduction} across submitted proofs.',
    'insight.close.impact': 'Impact: closing locks settlement scope and prevents late proof drift.',
    'insight.close.story': 'Proof coverage is complete; close event to lock scope.',
    'insight.settle.headline': 'Settlement is executable.',
    'insight.settle.reason': 'Event scope is locked and reward/penalty rates can be applied deterministically.',
    'insight.settle.impact': 'Impact: settlement computes payout and creates claimable records.',
    'insight.settle.story': 'Event closed; trigger settlement to materialize payouts.',
    'insight.claim.headline': 'Claim is pending.',
    'insight.claim.reason': 'Current claim state for Participant A: {claimStatus}.',
    'insight.claim.impact': 'Impact: claim finalizes participant payout receipt.',
    'insight.claim.story': 'Settlement done; participant claim is the next critical action.',
    'insight.audit.headline': 'Audit verification pending.',
    'insight.audit.reason': 'Run hash verification to confirm on-chain anchor and recomputed payload match.',
    'insight.audit.impact': 'Impact: audit pass unlocks review-grade confidence in evidence integrity.',
    'insight.audit.story': 'Claims complete; run audit to verify data integrity.',
    'insight.final.headline': 'Closed loop finalized.',
    'insight.final.reason': 'Create -> proofs -> close -> settle -> claim -> audit path has completed.',
    'insight.final.impact': 'Impact: payout and audit evidence are both finalized.',
    'insight.final.story': 'Closed loop complete: settleable, claimable, auditable.',
    'agent.analyzing': 'Agent is analyzing...',
    'agent.unavailable': 'Agent offline — using local analysis.',
    'agent.confidence': 'Confidence',
    'agent.suggested': 'Suggested',
    'agent.status.idle': 'Idle',
    'agent.status.active': 'Active ({count})',
    'agent.status.analyzing': 'Analyzing...',
    'agent.status.offline': 'Offline',
    'mission.agentStatus': 'Agent',
    'evidence.anomalyDetection': 'Anomaly Detection',
    'anomaly.severity.info': 'Info',
    'anomaly.severity.warning': 'Warning',
    'anomaly.severity.critical': 'Critical',
    'anomaly.noIssues': 'No anomalies detected.',
    'hero.finalized.title': 'Finalized: Closed loop complete',
    'hero.finalized.subtitle': 'All core steps reached final state with settlement and audit evidence.',
    'hero.error.title': 'Awaiting user action: fix {step}',
    'hero.error.subtitle': 'A blocking error occurred. Follow diagnostics and retry the highlighted step.',
    'hero.proofs.title': 'Awaiting proof: collect required participant submissions',
    'hero.proofs.subtitle': 'Proof coverage must reach {need}/{need} ({participants}) before closing the event.',
    'hero.settle.title': 'Awaiting settlement: execute payout calculation',
    'hero.settle.subtitle': 'Event scope is closed and ready for deterministic settlement.',
    'hero.audit.title': 'Awaiting audit: verify hash consistency',
    'hero.audit.subtitle': 'Run audit to prove recomputed payload hash equals on-chain anchor.',
    'hero.awaiting.title': 'Awaiting user action: {step}',
    'hero.txPending': '{subtitle} {count} tx still pending confirmation.',
    'timing.submitCreate': 'Submitting event creation request...',
    'timing.txBroadcast': 'Transaction broadcasted; waiting asynchronous confirmation...',
    'timing.submitProof': 'Submitting proof for {site}...',
    'timing.proofSubmitted': 'Proof transaction submitted; waiting background confirmation...',
    'timing.submitClose': 'Submitting close-event transaction...',
    'timing.closeSubmitted': 'Close transaction submitted; waiting background confirmation...',
    'timing.submitSettle': 'Submitting settlement transaction...',
    'timing.settleSubmitted': 'Settlement tx submitted; waiting background confirmation...',
    'timing.submitClaim': 'Submitting claim transaction for Participant A...',
    'timing.claimSubmitted': 'Claim tx submitted; waiting background confirmation...',
    'timing.fetchEvent': 'Fetching event snapshot...',
    'timing.fetchRecords': 'Fetching settlement records...',
    'timing.requestAudit': 'Requesting audit hash verification...',
    'timing.refreshSummary': 'Refreshing execution summary for visible state updates...',
    'timing.deferSummary': 'Summary refresh deferred for speed; final state sync continues in background.',
    'timing.awaitingTxConfirm': 'Waiting for {count} pending tx confirmation(s)...',
    'log.ready': 'ready',
    'log.run': 'run',
    'log.error': 'error',
    'log.createOk': 'create event ok',
    'log.proofOk': 'submit proof {site} ok',
    'log.closeOk': 'close event ok',
    'log.settleOk': 'settle ok',
    'log.claimOk': 'claim site-a ok',
    'log.eventDetail': 'event detail',
    'log.records': 'settlement records',
    'log.audit': 'audit record',
    'log.snapshotExport': 'snapshot export',
    'log.snapshotFallback': 'snapshot export fallback',
    'log.runStart': 'starting full flow for {eventId} (summary refresh deferred for speed)',
    'log.runDone': 'full flow completed',
    'log.readyMessage': 'DR Agent Mission Cockpit initialized',
    'log.trimmedPrefix': '[log] older entries trimmed for performance',
    'tab.crosschain': 'Cross-Chain',
    'crosschain.title': 'Cross-Chain Dashboard',
    'crosschain.bridgeTitle': 'Bridge Transfers',
    'crosschain.icmTitle': 'ICM Messages',
    'crosschain.refresh': 'Refresh',
    'crosschain.direction': 'Direction',
    'crosschain.amount': 'Amount',
    'crosschain.status': 'Status',
    'crosschain.sourceTx': 'Source Tx',
    'crosschain.destTx': 'Dest Tx',
    'crosschain.type': 'Type',
    'crosschain.route': 'Route',
    'crosschain.sender': 'Sender',
    'crosschain.pending': 'Pending',
    'crosschain.completed': 'Completed',
    'crosschain.noTransfers': 'No bridge transfers yet.',
    'crosschain.noMessages': 'No ICM messages yet.',
    'crosschain.noTransfersGuide': 'Start a bridge transfer to see data here.',
    'crosschain.noMessagesGuide': 'Send an ICM message to see data here.',
    'crosschain.connecting': 'connecting...',
    'story.crosschainStatus': 'Cross-Chain Status',
    'story.crosschainHint': 'Start a bridge transfer to see live cross-chain data here.',
    'visual.baselineMockHint': 'Submit proofs to compute real baseline values.',
    'visual.baselineTitle': 'Baseline Methods',
    'visual.confidence': 'Confidence',
    'visual.recommended': 'Recommended',
    'mission.bridgeStatus': 'Bridge',
    'mission.icmStatus': 'ICM',
  },
  zh: {
    'page.title': 'DR Agent 任务驾驶舱',
    'hero.eyebrow': '协议演示 | 执行审阅',
    'hero.title': 'DR Agent 任务驾驶舱',
    'hero.subtitle': '面向需求响应事件的可验证自动结算。',
    'mission.event': '事件',
    'mission.chainMode': '链模式',
    'mission.currentStep': '当前步骤',
    'mission.health': '健康度',
    'mission.latency': '延迟',
    'mission.flowProgress': '流程进度',
    'mode.experience': '体验模式',
    'mode.story': '叙事模式',
    'mode.engineering': '工程模式',
    'mode.hint.story': '叙事模式就是默认评审视角。',
    'mode.hint.engineering': '工程模式展示流程细节、诊断信息和原始证据。',
    'lang.en': 'EN',
    'lang.zh': '中文',
    'story.command': '任务指挥',
    'story.energyReduction': '节电量',
    'story.totalPayout': '总结算',
    'story.auditConfidence': '审计可信度',
    'story.challengeStatus': '争议状态',
    'story.agentThinking': 'Agent 思考',
    'story.viewTxEvidence': '查看交易证据',
    'story.evidenceHint': '可切换工程模式查看证据，或复制评审快照。',
    'story.agentInsightHint': '链上智能体实时信号，包含置信度与风险标记。',
    'story.latestTxLabel': '最新交易',
    'story.latestTxNone': '暂无交易',
    'story.latency.idle': '延迟：等待首次 API 调用。',
    'story.latency.running': '延迟：执行 {step} 中 | 已耗时 {elapsed} | API {api}。',
    'story.latency.breakdown': '延迟：{step} => API {api} + {summary} = {total}；{pending}。',
    'story.latency.pendingOnly': '延迟：正在等待 {count} 笔待确认交易。',
    'visual.title': '可视化洞察',
    'visual.subtitle': '随着 proof 与结算数据到达，图表会动态出现。',
    'visual.empty': '提交 proof 后将解锁 baseline 与 payout 图表。',
    'visual.comparisonTitle': '用户提交 vs 基线',
    'visual.payoutTitle': '结算拆分',
    'visual.confidenceWeight': '置信度加权',
    'visual.confidenceMethod': '方法',
    'visual.baseline': '基线',
    'visual.actual': '实际',
    'visual.pending': '待产生',
    'visual.reduction': '降幅',
    'action.next': '执行下一步',
    'action.runAll': '自动跑完整流程',
    'builder.mode': '构建模式',
    'builder.apiControlKeys': 'API 控制 / 密钥',
    'builder.apiControl': 'API 控制',
    'builder.baseUrl': '基础地址',
    'builder.eventId': '事件 ID',
    'builder.operatorKey': '运营方密钥',
    'builder.participantKey': '参与方密钥',
    'builder.auditorKey': '审计方密钥',
    'builder.hint': '若通过 `make api-run` 启动 API，请确保密钥与后端配置一致。',
    'tabs.missionPanels': '任务面板',
    'tab.control': '控制',
    'tab.event': '事件',
    'tab.audit': '审计',
    'flow.controls': '流程控制',
    'flow.createBtn': '1. 创建事件',
    'flow.proofABtn': '2. 提交 Proof A',
    'flow.proofBBtn': '3. 提交 Proof B',
    'flow.closeBtn': '4. 关闭事件',
    'flow.settleBtn': '5. 结算',
    'flow.claimBtn': '6. 领取 A',
    'flow.runAllBtn': '一键全流程',
    'flow.pathHint': '主叙事路径：创建 -> Proof -> 关闭 -> 结算 -> 领取 -> 审计。',
    'judge.title': '审阅视图',
    'judge.subtitle': '三层读数：任务上下文、KPI 结果、执行证据。',
    'step.create': '创建',
    'step.proofs': '证明',
    'step.close': '关闭',
    'step.settle': '结算',
    'step.claim': '领取',
    'step.audit': '审计',
    'step.completed': '完成',
    'kpi.status': '状态',
    'kpi.coverage': '证明覆盖率',
    'kpi.totalPayout': '总结算',
    'kpi.claimA': '领取（site-a）',
    'kpi.auditMatch': '审计一致性',
    'kpi.latency': '延迟',
    'evidence.proofCompare': 'Proof A 对比 Proof B',
    'evidence.proofAReduction': 'Proof A 降幅',
    'evidence.proofBReduction': 'Proof B 降幅',
    'evidence.auditAnchor': '审计锚点',
    'evidence.oneLineStory': '一句话叙事',
    'evidence.agentInsight': 'Agent 洞察',
    'evidence.executionDiagnostics': '执行诊断',
    'evidence.toggleOpen': '查看技术证据',
    'evidence.toggleClose': '隐藏技术证据',
    'query.event': '事件查询',
    'query.audit': '审计查询',
    'query.siteId': '站点 ID',
    'query.getEvent': '查询事件',
    'query.getRecords': '查询结算记录',
    'query.getAudit': '查询审计记录',
    'snapshot.copyJudge': '复制快照',
    'snapshot.copyEngineer': '复制工程快照',
    'snapshot.copiedJudge': '快照已复制到剪贴板。',
    'snapshot.copiedEngineer': '工程快照已复制到剪贴板。',
    'snapshot.fallback': '剪贴板不可用，已写入技术证据日志。',
    'snapshot.title': 'DR Agent - 执行快照',
    'snapshot.generated': '生成时间',
    'snapshot.theme': '主题',
    'snapshot.progress': '进度',
    'technical.title': '技术证据',
    'technical.subtitle': '用于工程复核的原始 JSON 日志。',
    'theme.cobalt': '主题：钴蓝',
    'theme.neon': '主题：霓虹',
    'camera.enable': '开启 Camera 模式',
    'camera.disable': '关闭 Camera 模式',
    'status.pending': '待处理',
    'status.in-progress': '进行中',
    'status.done': '已完成',
    'status.error': '错误',
    'status.active': '进行中',
    'status.closed': '已关闭',
    'status.settled': '已结算',
    'status.claimed': '已领取',
    'status.submitted': '已提交',
    'status.confirmed': '已确认',
    'status.failed': '失败',
    'status.completed': '完成',
    'status.verified': '已验证',
    'status.pass': 'PASS',
    'status.mismatch': '不一致',
    'status.read': '查询',
    'challenge.pending': '待审',
    'challenge.review': '审核中',
    'challenge.accepted': '已通过',
    'challenge.challenged': '被挑战',
    'network.fuji': 'Fuji 测试网',
    'network.fuji-live': 'Fuji 测试网（真实交易）',
    'network.mainnet': '主网',
    'network.simulated': '模拟模式',
    'network.local': '本地开发链',
    'label.participantA': '参与方 A',
    'label.participantB': '参与方 B',
    'label.hash': '哈希',
    'label.noWrites': '暂无写交易',
    'label.noTxHash': '无交易哈希',
    'label.none': '无',
    'label.lastAction': '最近动作',
    'label.lastTransition': '最近状态变更',
    'label.txPipeline': '交易流水',
    'diag.none.headline': '暂无活动错误。',
    'diag.none.hint': '流程护栏会阻止大多数无效操作。',
    'diag.none.next': '下一步：执行当前高亮步骤。',
    'diag.waitingConfirm.headline': '等待链上异步确认中。',
    'diag.waitingConfirm.hint': '共有 {count} 笔交易已提交，手续费/确认状态将自动回填。',
    'diag.waitingConfirm.next': '当前确认模式 {mode}。可继续执行流程并在刷新后查看确认。',
    'diag.running.headline': '正在执行 {step}...',
    'diag.running.hint': '{phase}',
    'diag.running.next': '已耗时 {elapsed} | API {api} | 确认模式 {mode}',
    'diag.delayBreakdown.headline': '延迟拆解：{step}{path}',
    'diag.delayBreakdown.hint': 'API {api} + {summary} = 总计 {total}。',
    'diag.delayBreakdown.summaryDeferred': 'summary 刷新已延后',
    'diag.delayBreakdown.summary': 'summary {summary}',
    'diag.delayBreakdown.next': '上一步总耗时 {total}（API {api}，{summaryPart}）；交易 {tx}。{pendingPart}',
    'diag.delayBreakdown.pending': '待确认交易：{count} 笔。',
    'diag.delayBreakdown.failed': '确认失败交易：{count} 笔。',
    'diag.delayBreakdown.nonePending': '当前无待确认交易。',
    'error.settleBlocked.headline': '结算被阻止：事件尚未关闭。',
    'error.settleBlocked.hint': '协议要求先关闭事件，再执行结算。',
    'error.settleBlocked.next': '下一步：点击“4. 关闭事件”后重试结算。',
    'error.duplicate.headline': '重复操作被拒绝。',
    'error.duplicate.hint': '该步骤似乎已经在当前事件中完成。',
    'error.duplicate.next': '下一步：执行下一个高亮步骤。',
    'error.auth.headline': '鉴权失败。',
    'error.auth.hint': 'API 密钥或 actor 权限与后端期望不一致。',
    'error.auth.next': '下一步：在 Builder Mode 核对 Operator/Participant/Auditor 密钥。',
    'error.pendingChain.headline': '前置链上步骤仍在确认中。',
    'error.pendingChain.hint': 'Hybrid 模式会先返回 tx hash；在前置交易上链前，依赖步骤可能失败。',
    'error.pendingChain.next': '下一步：等待几秒后重试；或改用 sync 确认模式保证严格顺序。',
    'error.pendingChain.timeoutHint': '已等待 {seconds} 秒，但待确认交易仍未上链。',
    'error.actionFailed.headline': '操作失败。',
    'error.actionFailed.next': '下一步：按高亮步骤修复后重试。',
    'error.failedStepPrefix': '失败步骤',
    'error.retrySuggestion': '重试建议',
    'hint.actionInProgress': '操作进行中。',
    'hint.proofANotRequired': '当前站点模式不要求 Proof A。',
    'hint.proofBNotRequired': '当前站点模式不要求 Proof B。',
    'hint.createEventFirst': '请先创建事件。',
    'hint.proofAAlready': 'Proof A 已提交或当前操作进行中。',
    'hint.proofBAlready': 'Proof B 已提交或当前操作进行中。',
    'hint.submitProofsFirst': '请先提交所需 proofs。',
    'hint.eventClosedOrBusy': '事件已关闭或当前操作进行中。',
    'hint.closeEventFirst': '请先关闭事件。',
    'hint.settlementDoneOrBusy': '结算已完成或当前操作进行中。',
    'hint.settleFirst': '请先执行结算。',
    'hint.claimDoneOrBusy': '领取已完成或当前操作进行中。',
    'hint.flowCompleted': '流程已完成。',
    'hint.auditPending': '尚未调用审计接口。',
    'hint.proofsWaiting': '等待所需 proofs：{participants}。',
    'hint.proofsRegistered': '所需参与方 proofs 已全部注册。',
    'hint.payoutAfterSettlement': '结算执行后显示 payout。',
    'hint.payoutSum': '该事件结算记录的 payout 总和（DRT）。',
    'hint.claimPending': '参与方 A 尚未完成领取。',
    'hint.claimDone': '参与方 A 已完成领取。',
    'hint.auditPass': '链上哈希与复算哈希一致。',
    'hint.auditMismatch': '检测到哈希不一致，请排查原始数据完整性。',
    'hint.apiRoundTrip': '浏览器最近一次 API 往返耗时。',
    'hint.eventPending': '请先创建事件以启动流程。',
    'hint.eventActive': '事件进行中，正在接收 proofs。',
    'hint.eventClosed': '事件已关闭，可执行结算。',
    'hint.eventSettled': '协议层结算已完成。',
    'hint.txPipeline': '交易流水：{pipeline}。',
    'narrative.default': '已就绪，可执行结算任务流程。',
    'narrative.completed': '闭环完成：可结算、可领取、可审计。',
    'narrative.audit': '领取已完成，执行审计以验证哈希一致性。',
    'narrative.claim': '结算已完成，下一步执行领取。',
    'narrative.settle': '事件已关闭，触发自动结算。',
    'narrative.close': 'proofs 已齐，关闭事件以锁定结算范围。',
    'narrative.proofs': '事件已创建，请收集所需 proofs（{participants}）。',
    'narrative.error': '{step} 失败：{message}',
    'audit.pending': '审计结果待生成。',
    'audit.pass': '审计通过：复算哈希与链上锚定一致。',
    'audit.mismatch': '审计不一致：复算哈希与链上锚定不一致。',
    'audit.passNoRecord': '审计通过：哈希校验完成。',
    'audit.mismatchNoRecord': '审计不一致：请在工程证据中查看详情。',
    'audit.hashInLogs': '哈希：可在工程模式日志中查看。',
    'proof.notSubmitted': 'Proof {tag}（{site}）：未提交。',
    'proof.summary': 'Proof {tag}（{site}）：基线 {baseline}，实际 {actual}，降幅 {reduction}。',
    'insight.error.headline': '检测到执行风险。',
    'insight.error.reason': '阻塞问题位于 {step}。请修复后重试。',
    'insight.error.impact': '影响：在阻塞步骤修复前，结算最终性会延后。',
    'insight.error.story': 'Agent 因执行风险暂停，需要人工处理。',
    'insight.txFailed.headline': '检测到链上确认失败。',
    'insight.txFailed.reason': '交易流水显示 {count} 笔失败交易。',
    'insight.txFailed.impact': '影响：需先重试失败步骤，才能信任结算最终性。',
    'insight.txFailed.story': '检测到链上失败，需运营侧重试。',
    'insight.txSubmitted.headline': '交易已提交到链上。',
    'insight.txSubmitted.reason': '当前有 {count} 笔交易待确认（{mode} 模式）。',
    'insight.txSubmitted.impact': '影响：流程可继续，手续费与确认状态会异步回填。',
    'insight.txSubmitted.story': '交易广播完成，等待确认中。',
    'insight.noEvent.headline': '尚未创建事件。',
    'insight.noEvent.reason': 'Agent 需要事件窗口作为 proof 收集与结算策略锚点。',
    'insight.noEvent.impact': '影响：当前尚无可量化结算或审计证据。',
    'insight.noEvent.story': '等待任务数据中。',
    'insight.proofs.headline': '正在收集参与方 proofs。',
    'insight.proofs.reason': '当前覆盖率 {coverage}；必需 proofs：{participants}。',
    'insight.proofs.impact': '影响：proof 未收齐前，payout 仍为临时估计。',
    'insight.proofs.story': '等待两位参与方提交 proofs。',
    'insight.close.headline': '已具备关闭范围条件。',
    'insight.close.reason': '已观测到总降幅 {reduction}。',
    'insight.close.impact': '影响：关闭后可锁定结算范围，避免后补 proof 漂移。',
    'insight.close.story': 'proof 覆盖已完成，可关闭事件锁定范围。',
    'insight.settle.headline': '可执行结算。',
    'insight.settle.reason': '事件范围已锁定，奖励/罚则可确定性计算。',
    'insight.settle.impact': '影响：结算将生成可领取记录。',
    'insight.settle.story': '事件已关闭，触发结算生成 payout。',
    'insight.claim.headline': '领取待完成。',
    'insight.claim.reason': '参与方 A 当前领取状态：{claimStatus}。',
    'insight.claim.impact': '影响：领取完成后 payout 才最终落地。',
    'insight.claim.story': '结算已完成，下一关键动作是领取。',
    'insight.audit.headline': '审计校验待完成。',
    'insight.audit.reason': '执行哈希校验，确认链上锚定与复算结果一致。',
    'insight.audit.impact': '影响：审计通过后，证据可信度显著提升。',
    'insight.audit.story': '领取完成后执行审计，验证数据完整性。',
    'insight.final.headline': '闭环已完成。',
    'insight.final.reason': 'create -> proofs -> close -> settle -> claim -> audit 路径已执行完毕。',
    'insight.final.impact': '影响：结算结果与审计证据均已最终化。',
    'insight.final.story': '闭环完成：可结算、可领取、可审计。',
    'agent.analyzing': '智能体分析中...',
    'agent.unavailable': '智能体离线 — 使用本地分析。',
    'agent.confidence': '置信度',
    'agent.suggested': '建议',
    'agent.status.idle': '待命',
    'agent.status.active': '运行中 ({count})',
    'agent.status.analyzing': '分析中...',
    'agent.status.offline': '离线',
    'mission.agentStatus': '智能体',
    'evidence.anomalyDetection': '异常检测',
    'anomaly.severity.info': '提示',
    'anomaly.severity.warning': '警告',
    'anomaly.severity.critical': '严重',
    'anomaly.noIssues': '未检测到异常。',
    'hero.finalized.title': '已最终完成：闭环结束',
    'hero.finalized.subtitle': '全部关键步骤已到达终态，并具备结算与审计证据。',
    'hero.error.title': '等待人工处理：修复 {step}',
    'hero.error.subtitle': '发生阻塞错误。请按诊断提示修复后重试高亮步骤。',
    'hero.proofs.title': '等待 proof：收集必需参与方提交',
    'hero.proofs.subtitle': 'proof 覆盖率需达到 {need}/{need}（{participants}）后才能关闭事件。',
    'hero.settle.title': '等待结算：执行 payout 计算',
    'hero.settle.subtitle': '事件范围已关闭，可执行确定性结算。',
    'hero.audit.title': '等待审计：验证哈希一致性',
    'hero.audit.subtitle': '运行审计以证明复算哈希与链上锚定哈希一致。',
    'hero.awaiting.title': '等待用户动作：{step}',
    'hero.txPending': '{subtitle} 当前仍有 {count} 笔交易待确认。',
    'timing.submitCreate': '正在提交创建事件请求...',
    'timing.txBroadcast': '交易已广播，等待异步确认...',
    'timing.submitProof': '正在提交 {site} 的 proof...',
    'timing.proofSubmitted': 'Proof 交易已提交，等待后台确认...',
    'timing.submitClose': '正在提交关闭事件交易...',
    'timing.closeSubmitted': '关闭交易已提交，等待后台确认...',
    'timing.submitSettle': '正在提交结算交易...',
    'timing.settleSubmitted': '结算交易已提交，等待后台确认...',
    'timing.submitClaim': '正在为参与方 A 提交领取交易...',
    'timing.claimSubmitted': '领取交易已提交，等待后台确认...',
    'timing.fetchEvent': '正在拉取事件快照...',
    'timing.fetchRecords': '正在拉取结算记录...',
    'timing.requestAudit': '正在请求审计哈希校验...',
    'timing.refreshSummary': '正在刷新执行汇总状态...',
    'timing.deferSummary': '为提速已延后 summary 刷新；最终状态将继续同步。',
    'timing.awaitingTxConfirm': '正在等待 {count} 笔待确认交易上链...',
    'log.ready': '就绪',
    'log.run': '执行',
    'log.error': '错误',
    'log.createOk': '创建事件成功',
    'log.proofOk': '提交 {site} 证明成功',
    'log.closeOk': '关闭事件成功',
    'log.settleOk': '结算成功',
    'log.claimOk': 'site-a 领取成功',
    'log.eventDetail': '事件详情',
    'log.records': '结算记录',
    'log.audit': '审计记录',
    'log.snapshotExport': '导出快照',
    'log.snapshotFallback': '导出快照降级',
    'log.runStart': '开始执行全流程：{eventId}（为提速已延后 summary 刷新）',
    'log.runDone': '全流程执行完成',
    'log.readyMessage': 'DR Agent Mission Cockpit 已初始化',
    'log.trimmedPrefix': '[日志] 为避免性能下降，已裁剪更早记录',
    'tab.crosschain': '跨链',
    'crosschain.title': '跨链仪表盘',
    'crosschain.bridgeTitle': '桥转账',
    'crosschain.icmTitle': '跨链消息',
    'crosschain.refresh': '刷新',
    'crosschain.direction': '方向',
    'crosschain.amount': '金额',
    'crosschain.status': '状态',
    'crosschain.sourceTx': '源交易',
    'crosschain.destTx': '目标交易',
    'crosschain.type': '类型',
    'crosschain.route': '路由',
    'crosschain.sender': '发送者',
    'crosschain.pending': '待处理',
    'crosschain.completed': '已完成',
    'crosschain.noTransfers': '暂无桥转账记录。',
    'crosschain.noMessages': '暂无跨链消息。',
    'crosschain.noTransfersGuide': '发起桥转账后，数据将在此显示。',
    'crosschain.noMessagesGuide': '发送跨链消息后，数据将在此显示。',
    'crosschain.connecting': '连接中...',
    'story.crosschainStatus': '跨链状态',
    'story.crosschainHint': '发起桥转账后，可在此查看实时跨链数据。',
    'visual.baselineMockHint': '提交证明后将计算真实基线值。',
    'visual.baselineTitle': '基线方法对比',
    'visual.confidence': '置信度',
    'visual.recommended': '推荐',
    'mission.bridgeStatus': '桥',
    'mission.icmStatus': 'ICM',
  },
};

const DEFAULT_ERROR_VIEW = {
  level: 'ok',
  headline: 'No active errors.',
  hint: 'Flow guards prevent most invalid actions.',
  next: 'Next: run the current highlighted step.',
};

function t(key, params = {}) {
  const langPack = I18N[state?.lang] || I18N.en;
  const template = langPack[key] ?? I18N.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) return String(params[name]);
    return `{${name}}`;
  });
}

function displayStatus(value) {
  const normalized = String(value || '').toLowerCase();
  const key = `status.${normalized}`;
  const translated = t(key);
  return translated === key ? String(value || '') : translated;
}

function formatChallengeStatus(status) {
  const normalized = String(status || '').toLowerCase();
  const key = `challenge.${normalized}`;
  const translated = t(key);
  return translated === key ? normalized || t('challenge.pending') : translated;
}

function deriveChallengeStatus(ui) {
  const summary = state.judgeSummary || {};
  const explicit =
    summary.challenge_status ||
    summary.challenge_state ||
    summary.proof_status ||
    summary.proof_state;
  if (explicit) return String(explicit).toLowerCase();

  const auditRequested = summary.audit_requested ?? !!state.audit;
  const auditMatch = summary.audit_match ?? (state.audit ? !!state.audit.match : null);
  if (auditRequested && auditMatch === false) return 'challenged';
  if (auditRequested && auditMatch === true) return 'accepted';
  if (ui.currentStep === 'audit' && auditRequested) return 'review';
  return 'pending';
}

function challengeChipState(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted') return 'done';
  if (normalized === 'challenged') return 'error';
  if (normalized === 'review') return 'in-progress';
  return 'pending';
}

function getBaselineConfidenceSummary() {
  const recommended = state.baselineResult || state.baselineComparison?.recommended || null;
  if (!recommended) return { confidence: null, method: null };
  const confidence = Number.isFinite(Number(recommended.confidence)) ? Number(recommended.confidence) : null;
  const method = recommended.method ? String(recommended.method) : null;
  return { confidence, method };
}

function makeDefaultErrorView() {
  return {
    level: 'ok',
    headline: t('diag.none.headline'),
    hint: t('diag.none.hint'),
    next: t('diag.none.next'),
  };
}

function renderStaticI18n() {
  const nodes = Array.from(document.querySelectorAll('[data-i18n]'));
  for (const node of nodes) {
    const key = node.getAttribute('data-i18n');
    if (!key) continue;
    const text = t(key);
    if (node.tagName === 'LABEL') {
      const childEl = Array.from(node.childNodes).find((c) => c.nodeType === Node.TEXT_NODE);
      if (childEl) childEl.textContent = `${text}\n              `;
      else node.prepend(document.createTextNode(`${text}\n              `));
    } else {
      node.textContent = text;
    }
  }

  const attrNodes = Array.from(document.querySelectorAll('[data-i18n-attr]'));
  for (const node of attrNodes) {
    const spec = node.getAttribute('data-i18n-attr');
    if (!spec) continue;
    const rules = spec.split(',').map((r) => r.trim()).filter(Boolean);
    for (const rule of rules) {
      const [attr, key] = rule.split(':').map((v) => v.trim());
      if (!attr || !key) continue;
      node.setAttribute(attr, t(key));
    }
  }
}

function refreshToggleText() {
  if (el.btnCameraMode) {
    el.btnCameraMode.textContent = state.cameraMode ? t('camera.disable') : t('camera.enable');
    el.btnCameraMode.setAttribute('aria-pressed', String(state.cameraMode));
  }
  if (el.btnTheme) {
    el.btnTheme.textContent = state.theme === 'neon' ? t('theme.neon') : t('theme.cobalt');
  }
  if (el.btnExportSnapshot) {
    el.btnExportSnapshot.textContent = state.viewMode === 'engineering' ? t('snapshot.copyEngineer') : t('snapshot.copyJudge');
  }
}

function applyLanguage(lang, shouldRender = true) {
  state.lang = lang === 'zh' ? 'zh' : 'en';
  localStorage.setItem('dr_lang', state.lang);
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.body.dataset.lang = state.lang;
  if (el.btnLangEn) {
    const active = state.lang === 'en';
    el.btnLangEn.classList.toggle('is-active', active);
    el.btnLangEn.setAttribute('aria-pressed', String(active));
  }
  if (el.btnLangZh) {
    const active = state.lang === 'zh';
    el.btnLangZh.classList.toggle('is-active', active);
    el.btnLangZh.setAttribute('aria-pressed', String(active));
  }
  renderStaticI18n();
  refreshToggleText();
  if (state.lastError) state.errorView = decodeError(state.lastError);
  else resetErrorView();
  if (shouldRender) renderAll();
}

const state = {
  event: null,
  proofs: {},
  settlements: [],
  audit: null,
  chainMode: 'unknown',
  txConfirmMode: 'hybrid',
  lastLatencyMs: null,
  lastAction: '',
  lastError: '',
  stepErrors: {},
  evidenceOpen: false,
  errorView: { ...DEFAULT_ERROR_VIEW },
  busy: false,
  builderOpen: false,
  theme: 'cobalt',
  cameraMode: false,
  lang: 'en',
  viewMode: 'story',
  judgeSummary: null,
  snapshotFeedback: '',
  logEntries: [],
  lastTransitionAt: '',
  requiredSites: [...DEFAULT_REQUIRED_PROOF_SITES],
  timing: {
    current: null,
    last: null,
    history: [],
  },
  bridgeTransfers: [],
  icmMessages: [],
  bridgeStats: { total_transfers: 0, pending_count: 0, completed_count: 0 },
  icmStats: { total_messages: 0, by_status: {}, by_type: {} },
  dashboardSummary: null,
  baselineComparison: null,
  baselineResult: null,
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

const persistedTheme = localStorage.getItem('dr_theme');
state.theme = persistedTheme === 'neon' ? 'neon' : 'cobalt';
document.body.dataset.theme = state.theme;

const persistedViewMode = localStorage.getItem('dr_view_mode');
state.viewMode = persistedViewMode === 'engineering' ? 'engineering' : 'story';
document.body.dataset.view = state.viewMode;
document.body.classList.toggle('judge-mode', state.viewMode === 'story');

const persistedLang = localStorage.getItem('dr_lang');
state.lang = persistedLang === 'zh' ? 'zh' : 'en';
state.errorView = makeDefaultErrorView();
applyLanguage(state.lang, false);

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

function requiredProofSites() {
  if (Array.isArray(state.requiredSites) && state.requiredSites.length > 0) {
    return state.requiredSites;
  }
  return DEFAULT_REQUIRED_PROOF_SITES;
}

function isLiveChainMode() {
  const mode = String(state.chainMode || '').toLowerCase();
  return mode === 'fuji-live' || mode === 'fuji' || mode === 'mainnet';
}

function shouldWaitForHybridConfirm() {
  return isLiveChainMode() && state.txConfirmMode === 'hybrid';
}

function resetErrorView() {
  state.errorView = makeDefaultErrorView();
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US');
}

function formatKwh(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${formatNumber(value)} kWh`;
}

function formatPayout(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${formatNumber(value)} DRT`;
}

function formatSignedPayout(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  const abs = formatNumber(Math.abs(value));
  if (value > 0) return `+${abs} DRT`;
  if (value < 0) return `-${abs} DRT`;
  return `0 DRT`;
}

/* ── countUp animation ──────────────────────────────────── */
function animateValue(element, toValue, suffix, duration) {
  if (!element) return;
  if (typeof toValue !== 'number' || Number.isNaN(toValue)) {
    element.textContent = suffix ? `- ${suffix}` : '-';
    return;
  }
  const fromValue = parseFloat((element._lastAnimatedValue ?? 0).toString()) || 0;
  if (fromValue === toValue) return;
  element._lastAnimatedValue = toValue;
  const startTime = performance.now();
  const locale = state.lang === 'zh' ? 'zh-CN' : 'en-US';
  const isInt = Number.isInteger(toValue) && Number.isInteger(fromValue);

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = fromValue + (toValue - fromValue) * eased;
    const display = isInt ? Math.round(current) : parseFloat(current.toFixed(1));
    element.textContent = suffix
      ? `${display.toLocaleString(locale)} ${suffix}`
      : display.toLocaleString(locale);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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

function formatMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return '--';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function startStepTiming(stepId, phase) {
  state.timing.current = {
    stepId,
    phase,
    startedAt: performance.now(),
    apiMs: null,
    apiPath: '',
    summaryMs: null,
    deferredSummary: false,
    txState: '',
    txHash: '',
  };
  renderAll();
}

function setStepTimingPhase(phase) {
  if (!state.timing.current) return;
  state.timing.current.phase = phase;
  renderAll();
}

function finishStepTiming(extra = {}) {
  if (!state.timing.current) return null;
  const current = state.timing.current;
  const entry = {
    ...current,
    ...extra,
    totalMs: performance.now() - current.startedAt,
    apiMs: extra.apiMs ?? current.apiMs,
    summaryMs: extra.summaryMs ?? current.summaryMs,
    deferredSummary: extra.deferredSummary ?? current.deferredSummary,
    txState: extra.txState || current.txState || '',
    txHash: extra.txHash || current.txHash || '',
    finishedAt: new Date().toISOString(),
  };
  state.timing.current = null;
  state.timing.last = entry;
  state.timing.history.push(entry);
  if (state.timing.history.length > MAX_STEP_TIMING_ENTRIES) {
    state.timing.history.shift();
  }
  return entry;
}

function stepLabel(stepId) {
  const found = FLOW_STEPS.find((step) => step.id === stepId);
  return found ? t(`step.${found.id}`) : t('step.create');
}

function formatNetworkMode(mode) {
  const key = String(mode || '').toLowerCase();
  if (key === 'fuji') return t('network.fuji');
  if (key === 'fuji-live') return t('network.fuji-live');
  if (key === 'mainnet') return t('network.mainnet');
  if (key === 'simulated') return t('network.simulated');
  if (key === 'local') return t('network.local');
  return mode || 'unknown';
}

function formatStepForSummary(stepId) {
  if (stepId === 'completed') return t('step.completed');
  return stepLabel(stepId);
}

function explorerTxBaseUrl(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (normalized === 'fuji' || normalized === 'fuji-live') {
    return 'https://testnet.snowtrace.io/tx/';
  }
  if (normalized === 'mainnet') {
    return 'https://snowtrace.io/tx/';
  }
  return '';
}

function getLatestTxHash() {
  for (let i = state.timing.history.length - 1; i >= 0; i -= 1) {
    const txHash = state.timing.history[i]?.txHash;
    if (txHash) return txHash;
  }

  const settlementClaim = state.settlements.find((row) => row?.claim_tx_hash)?.claim_tx_hash;
  if (settlementClaim) return settlementClaim;
  const settlementTx = state.settlements.find((row) => row?.tx_hash)?.tx_hash;
  if (settlementTx) return settlementTx;
  const closeTx = state.event?.close_tx_hash;
  if (closeTx) return closeTx;
  const eventTx = state.event?.tx_hash;
  if (eventTx) return eventTx;

  for (const proof of Object.values(state.proofs)) {
    if (proof?.tx_hash) return proof.tx_hash;
  }
  return '';
}

function siteDisplay(siteId) {
  if (state.viewMode === 'story') {
    if (siteId === 'site-a') return t('label.participantA');
    if (siteId === 'site-b') return t('label.participantB');
  }
  return siteId;
}

function truncateForDisplay(text, maxChars) {
  const raw = String(text ?? '').trim();
  if (!maxChars || raw.length <= maxChars) return raw;
  return `${raw.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function setTruncatedText(node, text, maxChars) {
  if (!node) return;
  const raw = String(text ?? '').trim();
  const display = truncateForDisplay(raw, maxChars);
  node.textContent = display;
  if (display !== raw) node.setAttribute('title', raw);
  else node.removeAttribute('title');
}

function applyViewMode(mode) {
  const next = VIEW_MODES.includes(mode) ? mode : 'story';
  state.viewMode = next;
  document.body.dataset.view = next;
  document.body.classList.toggle('judge-mode', next === 'story');
  localStorage.setItem('dr_view_mode', next);

  const mapping = [
    { node: el.btnViewStory, mode: 'story' },
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
    if (state.viewMode === 'story') el.modeHint.textContent = t('mode.hint.story');
    else el.modeHint.textContent = t('mode.hint.engineering');
  }
  refreshToggleText();
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
      headline: t('error.settleBlocked.headline'),
      hint: t('error.settleBlocked.hint'),
      next: t('error.settleBlocked.next'),
    };
  }

  if (
    normalized.includes('create_tx_pending_confirmation') ||
    normalized.includes('create transaction is submitted but not confirmed yet') ||
    normalized.includes('close_tx_pending_confirmation') ||
    normalized.includes('event_not_closed_onchain') ||
    normalized.includes('close transaction still pending confirmation') ||
    normalized.includes('settle_tx_pending_confirmation') ||
    normalized.includes('settlement transaction still pending confirmation')
  ) {
    return {
      level: 'warn',
      headline: t('error.pendingChain.headline'),
      hint: t('error.pendingChain.hint'),
      next: t('error.pendingChain.next'),
    };
  }

  if (normalized.includes('duplicate') || normalized.includes('already') || normalized.includes('proof_exists')) {
    return {
      level: 'warn',
      headline: t('error.duplicate.headline'),
      hint: t('error.duplicate.hint'),
      next: t('error.duplicate.next'),
    };
  }

  if (normalized.includes('401') || normalized.includes('403') || normalized.includes('unauthorized') || normalized.includes('forbidden')) {
    return {
      level: 'error',
      headline: t('error.auth.headline'),
      hint: t('error.auth.hint'),
      next: t('error.auth.next'),
    };
  }

  if (
    normalized.includes('chain_tx_failed') &&
    (normalized.includes('event not active') ||
      normalized.includes('event not found') ||
      normalized.includes('must be closed') ||
      normalized.includes('not claimable') ||
      normalized.includes('proof missing') ||
      normalized.includes('pending chain confirmation'))
  ) {
    return {
      level: 'warn',
      headline: t('error.pendingChain.headline'),
      hint: t('error.pendingChain.hint'),
      next: t('error.pendingChain.next'),
    };
  }

  if (
    normalized.includes('pending chain confirmation timeout') ||
    (normalized.includes('still submitted') && normalized.includes('pending'))
  ) {
    const match = normalized.match(/timeout after (\d+)s/);
    const seconds = match ? match[1] : '120';
    return {
      level: 'warn',
      headline: t('error.pendingChain.headline'),
      hint: t('error.pendingChain.timeoutHint', { seconds }),
      next: t('error.pendingChain.next'),
    };
  }

  return {
    level: 'error',
    headline: t('error.actionFailed.headline'),
    hint: message,
    next: t('error.actionFailed.next'),
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
  refreshToggleText();
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

function hasLocalFlowData() {
  return (
    !!state.event ||
    Object.keys(state.proofs).length > 0 ||
    state.settlements.length > 0 ||
    !!state.audit ||
    state.busy
  );
}

async function refreshJudgeSummary() {
  const c = cfg();
  if (!c.eventId || !hasLocalFlowData()) {
    state.judgeSummary = null;
    return;
  }

  try {
    const data = await callApi(`/judge/${c.eventId}/summary`, 'GET', null, c.auditorKey, 'auditor-1', {
      trackStepTiming: false,
    });
    state.judgeSummary = data;
    if (data?.network_mode) state.chainMode = data.network_mode;
    if (data?.last_transition_at) state.lastTransitionAt = data.last_transition_at;
  } catch (err) {
    const text = String(err?.message || '');
    if (text.includes('/judge/') && text.includes('404')) {
      state.judgeSummary = null;
      return;
    }
    // Only swallow not-found during early lifecycle; surface other judge errors.
    throw err;
  }
}

function buildJudgeSnapshot() {
  const ui = deriveUiState();
  const requiredSites = requiredProofSites();
  const coverageDenominator = requiredSites.length || 1;
  const coveragePct = Math.round((ui.proofCount / coverageDenominator) * 100);
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
    proof_coverage: `${ui.proofCount}/${coverageDenominator} (${coveragePct}%)`,
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
    t('snapshot.title'),
    `${t('snapshot.generated')}: ${snapshot.generated_at}`,
    `${t('mission.event')}: ${snapshot.event_id}`,
    `${t('snapshot.theme')}: ${snapshot.theme}`,
    `${t('mission.chainMode')}: ${snapshot.chain_mode}`,
    `${t('mission.currentStep')}: ${formatStepForSummary(snapshot.current_step)}`,
    `${t('mission.health')}: ${displayStatus(snapshot.health)}`,
    `${t('kpi.status')}: ${displayStatus(snapshot.status)}`,
    `${t('snapshot.progress')}: ${snapshot.progress}`,
    `${t('kpi.coverage')}: ${snapshot.proof_coverage}`,
    `${t('kpi.totalPayout')}: ${snapshot.total_payout_drt} DRT`,
    `${t('kpi.claimA')}: ${displayStatus(snapshot.claim_site_a)}`,
    `${t('kpi.auditMatch')}: ${
      snapshot.audit_match === null ? displayStatus('pending') : snapshot.audit_match ? t('status.pass') : t('status.mismatch')
    }`,
    `${t('kpi.latency')}: ${snapshot.latency_ms == null ? '--' : `${snapshot.latency_ms} ms`}`,
    `${t('evidence.oneLineStory')}: ${snapshot.narrative}`,
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
    ? mode === 'full'
      ? t('snapshot.copiedEngineer')
      : t('snapshot.copiedJudge')
    : t('snapshot.fallback');

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
  if (!proof) return t('proof.notSubmitted', { tag, site: siteLabel });
  return t('proof.summary', {
    tag,
    site: siteLabel,
    baseline: proof.baseline_kwh,
    actual: proof.actual_kwh,
    reduction: proof.reduction_kwh,
  });
}

function getClaimRecord() {
  return state.settlements.find((row) => row.site_id === 'site-a');
}

function normalizeTxState(txState, txFeeWei) {
  const normalized = String(txState || '').toLowerCase();
  if (normalized === 'failed') return 'failed';
  if (normalized === 'confirmed') return 'confirmed';
  if (normalized === 'submitted') return 'submitted';
  if (txFeeWei !== null && txFeeWei !== undefined && String(txFeeWei) !== '') return 'confirmed';
  return 'submitted';
}

function collectTxPipeline() {
  if (
    state.judgeSummary &&
    Number.isFinite(state.judgeSummary.tx_pipeline_total) &&
    Number.isFinite(state.judgeSummary.tx_pipeline_submitted) &&
    Number.isFinite(state.judgeSummary.tx_pipeline_confirmed) &&
    Number.isFinite(state.judgeSummary.tx_pipeline_failed)
  ) {
    return {
      total: Number(state.judgeSummary.tx_pipeline_total),
      submitted: Number(state.judgeSummary.tx_pipeline_submitted),
      confirmed: Number(state.judgeSummary.tx_pipeline_confirmed),
      failed: Number(state.judgeSummary.tx_pipeline_failed),
    };
  }

  const byHash = new Map();

  function register(txHash, txState, txFeeWei) {
    if (!txHash) return;
    const nextState = normalizeTxState(txState, txFeeWei);
    const prevState = byHash.get(txHash);
    if (!prevState) {
      byHash.set(txHash, nextState);
      return;
    }
    if (prevState === 'failed' || nextState === 'failed') {
      byHash.set(txHash, 'failed');
      return;
    }
    if (prevState === 'submitted' || nextState === 'submitted') {
      byHash.set(txHash, 'submitted');
      return;
    }
    byHash.set(txHash, 'confirmed');
  }

  register(state.event?.tx_hash, state.event?.tx_state, state.event?.tx_fee_wei);
  register(state.event?.close_tx_hash, state.event?.close_tx_state, state.event?.close_tx_fee_wei);

  Object.values(state.proofs).forEach((proof) => {
    register(proof?.tx_hash, proof?.tx_state, proof?.tx_fee_wei);
  });

  state.settlements.forEach((settlement) => {
    register(settlement?.tx_hash, settlement?.tx_state, settlement?.tx_fee_wei);
    register(settlement?.claim_tx_hash, settlement?.claim_tx_state, settlement?.claim_tx_fee_wei);
  });

  const counts = { total: byHash.size, submitted: 0, confirmed: 0, failed: 0 };
  byHash.forEach((txState) => {
    if (txState === 'failed') counts.failed += 1;
    else if (txState === 'confirmed') counts.confirmed += 1;
    else counts.submitted += 1;
  });
  return counts;
}

function formatTxPipelineCompact(stats) {
  if (!stats.total) return t('label.noWrites');
  return `${stats.confirmed} ${displayStatus('confirmed')} / ${stats.submitted} ${displayStatus('submitted')} / ${stats.failed} ${displayStatus('failed')}`;
}

function deriveUiState() {
  const requiredSites = requiredProofSites();
  const proofCount = Object.keys(state.proofs).length;
  const proofsDone = requiredSites.every((siteId) => !!state.proofs[siteId]);
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
    requiredSites,
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
  const coverage = `${ui.proofCount}/${ui.requiredSites.length}`;
  const claimStatus = displayStatus(ui.claimRecord?.status || 'pending');
  const requiredParticipants = ui.requiredSites.map((siteId) => siteDisplay(siteId)).join(', ');
  const txPipeline = collectTxPipeline();

  if (state.lastError) {
    return {
      headline: t('insight.error.headline'),
      reason: t('insight.error.reason', {
        step: formatStepForSummary(endpointToStep(state.lastError) || ui.currentStep),
      }),
      impact: t('insight.error.impact'),
      story: t('insight.error.story'),
    };
  }

  if (txPipeline.failed > 0) {
    return {
      headline: t('insight.txFailed.headline'),
      reason: t('insight.txFailed.reason', { count: txPipeline.failed }),
      impact: t('insight.txFailed.impact'),
      story: t('insight.txFailed.story'),
    };
  }

  if (txPipeline.submitted > 0) {
    return {
      headline: t('insight.txSubmitted.headline'),
      reason: t('insight.txSubmitted.reason', { count: txPipeline.submitted, mode: state.txConfirmMode }),
      impact: t('insight.txSubmitted.impact'),
      story: t('insight.txSubmitted.story'),
    };
  }

  if (!state.event) {
    return {
      headline: t('insight.noEvent.headline'),
      reason: t('insight.noEvent.reason'),
      impact: t('insight.noEvent.impact'),
      story: t('insight.noEvent.story'),
    };
  }

  if (ui.currentStep === 'proofs') {
    return {
      headline: t('insight.proofs.headline'),
      reason: t('insight.proofs.reason', {
        coverage,
        participants: requiredParticipants || `${t('label.participantA')}, ${t('label.participantB')}`,
      }),
      impact: t('insight.proofs.impact'),
      story: t('insight.proofs.story'),
    };
  }

  if (ui.currentStep === 'close') {
    return {
      headline: t('insight.close.headline'),
      reason: t('insight.close.reason', { reduction: formatKwh(reduction) }),
      impact: t('insight.close.impact'),
      story: t('insight.close.story'),
    };
  }

  if (ui.currentStep === 'settle') {
    return {
      headline: t('insight.settle.headline'),
      reason: t('insight.settle.reason'),
      impact: t('insight.settle.impact'),
      story: t('insight.settle.story'),
    };
  }

  if (ui.currentStep === 'claim') {
    return {
      headline: t('insight.claim.headline'),
      reason: t('insight.claim.reason', { claimStatus }),
      impact: t('insight.claim.impact'),
      story: t('insight.claim.story'),
    };
  }

  if (ui.currentStep === 'audit') {
    return {
      headline: t('insight.audit.headline'),
      reason: t('insight.audit.reason'),
      impact: t('insight.audit.impact'),
      story: t('insight.audit.story'),
    };
  }

  return {
    headline: t('insight.final.headline'),
    reason: t('insight.final.reason'),
    impact: t('insight.final.impact'),
    story: t('insight.final.story'),
  };
}

/* ── Agent API integration ── */

const agentState = { analysisCount: 0, anomalyCount: 0, lastStep: null, abortController: null, status: 'idle' };
const baselineState = { lastKey: null };

function setAgentStatus(status) {
  agentState.status = status;
  if (!el.agentStatusDot || !el.agentStatusLabel) return;
  el.agentStatusDot.className = 'agent-dot ' + status;
  if (status === 'active') {
    el.agentStatusLabel.textContent = t('agent.status.active', { count: agentState.analysisCount });
  } else if (status === 'analyzing') {
    el.agentStatusLabel.textContent = t('agent.status.analyzing');
  } else if (status === 'offline') {
    el.agentStatusLabel.textContent = t('agent.status.offline');
  } else {
    el.agentStatusLabel.textContent = t('agent.status.idle');
  }
}

async function typewriterRender(element, text, speed) {
  if (!element) return;
  speed = speed || 30;
  text = text == null ? '' : String(text);
  element.textContent = '';
  element.classList.add('typing');
  element._abortTyping = false;
  for (let i = 0; i < text.length; i++) {
    if (element._abortTyping) { element._abortTyping = false; break; }
    element.textContent += text[i];
    const pause = /[。，.!?;：]/.test(text[i]) ? speed * 3 : speed;
    await new Promise(function(r) { setTimeout(r, pause); });
  }
  element.classList.remove('typing');
}

async function renderInsightCopy(headline, reason, impact, storyLine, typeDetails) {
  const headlineText = headline == null ? '' : String(headline);
  const reasonText = reason == null ? '' : String(reason);
  const impactText = impact == null ? '' : String(impact);
  const storyText = storyLine == null ? headlineText : String(storyLine);

  await Promise.all([
    typewriterRender(el.insightHeadline, headlineText),
    typewriterRender(el.storyInsightHeadline, headlineText),
    typewriterRender(el.storyInsight, storyText),
  ]);

  if (typeDetails) {
    await Promise.all([
      typewriterRender(el.insightReason, reasonText, 18),
      typewriterRender(el.insightImpact, impactText, 18),
      typewriterRender(el.storyInsightReason, reasonText, 18),
      typewriterRender(el.storyInsightImpact, impactText, 18),
    ]);
    return;
  }

  if (el.insightReason) el.insightReason.textContent = reasonText;
  if (el.insightImpact) el.insightImpact.textContent = impactText;
  if (el.storyInsightReason) el.storyInsightReason.textContent = reasonText;
  if (el.storyInsightImpact) el.storyInsightImpact.textContent = impactText;
}

function renderConfidenceBarInto(confidence, barEl, pctEl, metaEl) {
  if (!barEl || !pctEl || !metaEl) return;
  metaEl.style.display = '';
  const pct = Math.round(confidence * 100);
  barEl.style.width = pct + '%';
  pctEl.textContent = pct + '%';
  barEl.className = 'confidence-fill ' + (pct < 40 ? 'low' : pct < 70 ? 'mid' : 'high');
}

function renderConfidenceBar(confidence) {
  renderConfidenceBarInto(confidence, el.confidenceBar, el.confidencePct, el.insightMeta);
}

function renderStoryConfidenceBar(confidence) {
  renderConfidenceBarInto(confidence, el.storyConfidenceBar, el.storyConfidencePct, el.storyInsightMeta);
}

function renderRiskFlagsInto(flags, container) {
  if (!container) return;
  container.innerHTML = '';
  if (!flags || flags.length === 0) return;
  flags.forEach(function(flag) {
    var span = document.createElement('span');
    span.className = 'risk-flag';
    span.textContent = flag.replace(/_/g, ' ');
    container.appendChild(span);
  });
}

function renderRiskFlags(flags) {
  renderRiskFlagsInto(flags, el.riskFlags);
}

function renderStoryRiskFlags(flags) {
  renderRiskFlagsInto(flags, el.storyRiskFlags);
}

function renderSuggestedActionInto(action, element) {
  if (!element) return;
  if (action) {
    element.style.display = '';
    element.textContent = action;
  } else {
    element.style.display = 'none';
  }
}

function renderSuggestedAction(action) {
  renderSuggestedActionInto(action, el.suggestedAction);
}

function renderStorySuggestedAction(action) {
  renderSuggestedActionInto(action, el.storySuggestedAction);
}

function formatDataPointValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return formatNumber(value);
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

function renderDataPointsInto(dataPoints, container) {
  if (!container) return;
  container.innerHTML = '';
  if (!dataPoints || typeof dataPoints !== 'object') {
    container.style.display = 'none';
    return;
  }
  const entries = Object.entries(dataPoints);
  if (entries.length === 0) {
    container.style.display = 'none';
    return;
  }
  entries.forEach(function(entry) {
    const key = entry[0];
    const value = formatDataPointValue(entry[1]);
    const chip = document.createElement('span');
    chip.className = 'data-point-chip';
    const keySpan = document.createElement('span');
    keySpan.className = 'key';
    keySpan.textContent = key;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = value;
    chip.appendChild(keySpan);
    chip.appendChild(document.createTextNode(': '));
    chip.appendChild(valueSpan);
    container.appendChild(chip);
  });
  container.style.display = '';
}

function toggleInsightSkeleton(show, skeletonEl, contentEl, metaEl) {
  if (skeletonEl) skeletonEl.style.display = show ? '' : 'none';
  if (contentEl) contentEl.style.display = show ? 'none' : '';
  if (metaEl) metaEl.style.display = show ? 'none' : '';
}

function showInsightSkeleton(show) {
  toggleInsightSkeleton(show, el.insightSkeleton, el.insightContent, el.insightMeta);
}

function showStoryInsightSkeleton(show) {
  toggleInsightSkeleton(show, el.storyInsightSkeleton, el.storyInsightContent, el.storyInsightMeta);
}

async function fetchAgentInsight(ui) {
  var stepKey = (ui.currentStep || 'create') + ':' + (state.event?.event_id || 'none') + ':' + Object.keys(state.proofs).length;
  if (stepKey === agentState.lastStep) return;
  // Cancel previous in-flight request
  if (agentState.abortController) {
    agentState.abortController.abort();
  }
  agentState.abortController = null;
  agentState.lastStep = stepKey;

  // Abort old typewriter animations
  if (el.insightHeadline) el.insightHeadline._abortTyping = true;
  if (el.insightReason) el.insightReason._abortTyping = true;
  if (el.insightImpact) el.insightImpact._abortTyping = true;
  if (el.storyInsightHeadline) el.storyInsightHeadline._abortTyping = true;
  if (el.storyInsightReason) el.storyInsightReason._abortTyping = true;
  if (el.storyInsightImpact) el.storyInsightImpact._abortTyping = true;
  if (el.storyInsight) el.storyInsight._abortTyping = true;

  var fallbackInsight = buildAgentInsight(ui);
  var impactText = fallbackInsight?.impact || '';
  var storyLine = fallbackInsight?.story || fallbackInsight?.headline || '';
  var typeDetails = state.viewMode === 'story';

  if (!state.event) {
    showInsightSkeleton(false);
    showStoryInsightSkeleton(false);
    await renderInsightCopy(fallbackInsight.headline, fallbackInsight.reason, impactText, storyLine, typeDetails);
    if (el.insightMeta) el.insightMeta.style.display = 'none';
    if (el.storyInsightMeta) el.storyInsightMeta.style.display = 'none';
    if (el.insightDataPoints) el.insightDataPoints.style.display = 'none';
    if (el.storyDataPoints) el.storyDataPoints.style.display = 'none';
    renderSuggestedActionInto(null, el.suggestedAction);
    renderSuggestedActionInto(null, el.storySuggestedAction);
    setAgentStatus('idle');
    return;
  }

  agentState.abortController = new AbortController();
  setAgentStatus('analyzing');
  showInsightSkeleton(true);
  showStoryInsightSkeleton(true);

  var payload = {
    event_id: state.event?.event_id || null,
    current_step: ui.currentStep || 'create',
    proofs: Object.values(state.proofs).map(function(p) {
      return { site_id: p.site_id, baseline_kwh: p.baseline_kwh, actual_kwh: p.actual_kwh, reduction_kwh: p.reduction_kwh };
    }),
    baseline_result: state.baselineResult || null,
    settlement: state.settlements && state.settlements[0] ? state.settlements[0] : null,
    tx_pipeline: collectTxPipeline ? [collectTxPipeline()] : [],
    lang: state.lang || 'en',
  };

  try {
    var c = cfg();
    var resp = await fetch(c.baseUrl + '/v1/agent/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': c.operatorKey, 'x-actor-id': 'ui-agent' },
      body: JSON.stringify(payload),
      signal: agentState.abortController.signal,
    });
    if (!resp.ok) throw new Error('Agent API ' + resp.status);
    var data = await resp.json();
    agentState.analysisCount++;
    var liveStoryLine = fallbackInsight?.story || data.headline || '';

    showInsightSkeleton(false);
    showStoryInsightSkeleton(false);
    await renderInsightCopy(data.headline, data.reasoning, impactText, liveStoryLine, typeDetails);
    renderConfidenceBar(data.confidence);
    renderStoryConfidenceBar(data.confidence);
    renderRiskFlags(data.risk_flags);
    renderStoryRiskFlags(data.risk_flags);
    renderSuggestedAction(data.suggested_action);
    renderStorySuggestedAction(data.suggested_action);
    renderDataPointsInto(data.data_points, el.insightDataPoints);
    renderDataPointsInto(data.data_points, el.storyDataPoints);

    setAgentStatus('active');
  } catch (e) {
    if (e.name === 'AbortError') return;
    // Fallback to local buildAgentInsight
    showInsightSkeleton(false);
    showStoryInsightSkeleton(false);
    try {
      await renderInsightCopy(
        fallbackInsight.headline,
        fallbackInsight.reason,
        impactText,
        storyLine,
        typeDetails
      );
      if (el.insightMeta) el.insightMeta.style.display = 'none';
      if (el.storyInsightMeta) el.storyInsightMeta.style.display = 'none';
      if (el.insightDataPoints) el.insightDataPoints.style.display = 'none';
      if (el.storyDataPoints) el.storyDataPoints.style.display = 'none';
      renderSuggestedActionInto(null, el.suggestedAction);
      renderSuggestedActionInto(null, el.storySuggestedAction);
    } catch (_) {
      if (el.insightHeadline) el.insightHeadline.textContent = t('agent.unavailable');
      if (el.storyInsightHeadline) el.storyInsightHeadline.textContent = t('agent.unavailable');
    }
    setAgentStatus('offline');
  }
}

async function fetchAgentAnomaly(ui) {
  var proofs = Object.values(state.proofs);
  if (proofs.length < 2) {
    if (el.anomalyCard) el.anomalyCard.style.display = 'none';
    return;
  }
  try {
    var c = cfg();
    var resp = await fetch(c.baseUrl + '/v1/agent/anomaly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': c.operatorKey, 'x-actor-id': 'ui-agent' },
      body: JSON.stringify({
        proofs: proofs.map(function(p) {
          return { site_id: p.site_id, baseline_kwh: p.baseline_kwh, actual_kwh: p.actual_kwh, reduction_kwh: p.reduction_kwh };
        }),
        baseline_result: state.baselineResult || null,
        event_id: state.event?.event_id || null,
      }),
    });
    if (!resp.ok) throw new Error('Anomaly API ' + resp.status);
    var data = await resp.json();
    renderAnomalyCard(data);
  } catch (_) {
    if (el.anomalyCard) el.anomalyCard.style.display = 'none';
  }
}

function renderAnomalyCard(report) {
  if (!el.anomalyCard) return;
  if (!report.has_anomaly) {
    el.anomalyCard.style.display = 'none';
    return;
  }
  el.anomalyCard.style.display = '';
  el.anomalyCard.dataset.severity = report.severity;
  if (el.anomalyBadge) {
    el.anomalyBadge.textContent = t('anomaly.severity.' + report.severity) || report.severity;
    el.anomalyBadge.className = 'anomaly-badge severity-' + report.severity;
  }
  if (el.anomalyType) el.anomalyType.textContent = (report.anomaly_type || '').replace(/_/g, ' ');
  if (el.anomalyDescription) el.anomalyDescription.textContent = report.description;
  if (el.anomalyRecommendation) el.anomalyRecommendation.textContent = report.recommendation;
  if (el.anomalyAffectedList) {
    el.anomalyAffectedList.innerHTML = '';
    (report.affected_proofs || []).forEach(function(siteId) {
      var span = document.createElement('span');
      span.className = 'anomaly-affected-item';
      span.textContent = siteDisplay(siteId);
      el.anomalyAffectedList.appendChild(span);
    });
  }
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
  const chainLabel = formatNetworkMode(summary?.network_mode || state.chainMode || 'unknown');
  el.missionChainMode.textContent = `${chainLabel} · ${state.txConfirmMode}`;
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
  el.missionHealth.textContent = displayStatus(health);
  el.missionHealth.className = `status-chip ${health}`;

  if (el.missionBridgeStatus) {
    const bp = state.bridgeStats.pending_count;
    el.missionBridgeStatus.textContent = bp > 0 ? `${bp} pending` : 'idle';
    el.missionBridgeStatus.className = `value${bp > 0 ? ' status-warn' : ''}`;
  }
  if (el.missionICMStatus) {
    const ip = (state.icmStats.by_status || {}).pending || 0;
    el.missionICMStatus.textContent = ip > 0 ? `${ip} pending` : 'idle';
    el.missionICMStatus.className = `value${ip > 0 ? ' status-warn' : ''}`;
  }
}

function renderFlowTimeline(ui) {
  for (const step of FLOW_STEPS) {
    const node = document.getElementById(`step-${step.id}`);
    if (!node) continue;
    const status = flowStepStatus(step.id, ui);
    node.classList.remove('pending', 'in-progress', 'done', 'error');
    node.classList.add(status);
    const statusNode = node.querySelector('.step-state');
    if (statusNode) statusNode.textContent = displayStatus(status);
  }
}

function renderKpiGrid(ui) {
  const summary = state.judgeSummary;
  const coverageCount = summary?.proof_submitted ?? ui.proofCount;
  const coverageNeed = summary?.proof_required ?? ui.requiredSites.length;
  const coveragePct = Math.round((coverageCount / coverageNeed) * 100);
  const eventStatus = summary?.event_status || ui.eventStatus;
  const totalPayout = summary?.total_payout_drt ?? ui.totalPayout;
  const claimStatus = summary?.claim_site_a_status || ui.claimRecord?.status || 'pending';
  const auditRequested = summary?.audit_requested ?? !!state.audit;
  const auditMatch = summary?.audit_match ?? (state.audit ? !!state.audit.match : null);
  const challengeStatus = deriveChallengeStatus(ui);
  const challengeLabel = `${t('story.challengeStatus')}: ${formatChallengeStatus(challengeStatus)}`;
  const requiredParticipantLabel = ui.requiredSites.map((siteId) => siteDisplay(siteId)).join(' and ');
  const txPipeline = collectTxPipeline();

  setTextWithPulse(el.kpiStatus, displayStatus(eventStatus));
  if (eventStatus === 'pending') el.kpiStatusHint.textContent = t('hint.eventPending');
  else if (eventStatus === 'active') el.kpiStatusHint.textContent = t('hint.eventActive');
  else if (eventStatus === 'closed') el.kpiStatusHint.textContent = t('hint.eventClosed');
  else el.kpiStatusHint.textContent = t('hint.eventSettled');
  if (txPipeline.total > 0) {
    el.kpiStatusHint.textContent = `${el.kpiStatusHint.textContent} ${t('hint.txPipeline', {
      pipeline: formatTxPipelineCompact(txPipeline),
    })}`;
  }

  setTextWithPulse(el.kpiCoverage, `${coverageCount} / ${coverageNeed} (${coveragePct}%)`);
  el.kpiCoverageHint.textContent = ui.proofsDone
    ? t('hint.proofsRegistered')
    : t('hint.proofsWaiting', {
        participants: requiredParticipantLabel || `${t('label.participantA')} and ${t('label.participantB')}`,
      });

  animateValue(el.kpiPayout, totalPayout, 'DRT', 600);
  el.kpiPayoutHint.textContent = ui.settleDone
    ? t('hint.payoutSum')
    : t('hint.payoutAfterSettlement');

  setTextWithPulse(el.kpiClaim, displayStatus(claimStatus));
  el.kpiClaimHint.textContent = ui.claimDone
    ? t('hint.claimDone')
    : t('hint.claimPending');

  setTextWithPulse(el.kpiAudit, !auditRequested ? displayStatus('pending') : auditMatch ? t('status.pass') : t('status.mismatch'));
  el.kpiAuditHint.textContent = `${!auditRequested
    ? t('hint.auditPending')
    : auditMatch
      ? t('hint.auditPass')
      : t('hint.auditMismatch')} · ${challengeLabel}`;

  if (state.lastLatencyMs == null) {
    setTextWithPulse(el.kpiLatency, '-- ms');
  } else {
    animateValue(el.kpiLatency, Math.round(state.lastLatencyMs), 'ms', 400);
  }
  el.kpiLatencyHint.textContent = t('hint.apiRoundTrip');

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
    return clampStory(t('narrative.error', { step, message: compact }));
  }

  if (ui.currentStep === 'completed') {
    return t('narrative.completed');
  }
  if (ui.currentStep === 'audit') {
    return t('narrative.audit');
  }
  if (ui.currentStep === 'claim') {
    return t('narrative.claim');
  }
  if (ui.currentStep === 'settle') {
    return t('narrative.settle');
  }
  if (ui.currentStep === 'close') {
    return t('narrative.close');
  }
  if (ui.currentStep === 'proofs') {
    const labels = ui.requiredSites.map((siteId) => siteDisplay(siteId)).join(' + ');
    return t('narrative.proofs', { participants: labels || `${t('label.participantA')} + ${t('label.participantB')}` });
  }
  return t('narrative.default');
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
    el.evidenceAuditResult.textContent = t('audit.pending');
    el.evidenceAuditHash.textContent = `${t('label.hash')}: -`;
  } else if (state.audit) {
    el.evidenceAuditResult.textContent = auditMatch
      ? t('audit.pass')
      : t('audit.mismatch');
    el.evidenceAuditHash.textContent = `${t('label.hash')}: ${shortHash(state.audit.proof_hash_onchain)} | ${shortHash(state.audit.proof_hash_recomputed)}`;
  } else {
    el.evidenceAuditResult.textContent = auditMatch
      ? t('audit.passNoRecord')
      : t('audit.mismatchNoRecord');
    el.evidenceAuditHash.textContent = t('audit.hashInLogs');
  }

  el.narrativeLine.textContent = buildNarrative(ui);
  const lastTransition = state.judgeSummary?.last_transition_at || state.lastTransitionAt;
  const txPipeline = collectTxPipeline();
  el.lastActionLine.textContent = `${t('label.lastAction')}: ${state.lastAction || t('label.none')}${
    lastTransition ? ` | ${t('label.lastTransition')}: ${lastTransition}` : ''
  } | ${t('label.txPipeline')}: ${formatTxPipelineCompact(txPipeline)}`;

  // Async agent insight — fires in background, does not block render
  fetchAgentInsight(ui);
  fetchAgentAnomaly(ui);
}

function renderErrorCard(ui) {
  if (!el.errorCard) return;
  const diagnostics = buildDiagnosticsView(ui);
  el.errorCard.dataset.level = diagnostics.level || 'ok';
  el.errorHeadline.textContent = diagnostics.headline;
  el.errorHint.textContent = diagnostics.hint;
  el.errorNext.textContent = diagnostics.next;
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
  const txPipeline = collectTxPipeline();
  let heroTitle = '';
  let heroSubtitle = '';

  if (activeStep === 'completed') {
    heroTitle = t('hero.finalized.title');
    heroSubtitle = t('hero.finalized.subtitle');
  } else if (state.lastError) {
    heroTitle = t('hero.error.title', {
      step: formatStepForSummary(endpointToStep(state.lastError) || activeStep),
    });
    heroSubtitle = t('hero.error.subtitle');
  } else if (activeStep === 'proofs') {
    const needed = ui.requiredSites.map((siteId) => siteDisplay(siteId)).join(' + ');
    heroTitle = t('hero.proofs.title');
    heroSubtitle = t('hero.proofs.subtitle', {
      need: ui.requiredSites.length,
      participants: needed || `${t('label.participantA')} + ${t('label.participantB')}`,
    });
  } else if (activeStep === 'settle') {
    heroTitle = t('hero.settle.title');
    heroSubtitle = t('hero.settle.subtitle');
  } else if (activeStep === 'audit') {
    heroTitle = t('hero.audit.title');
    heroSubtitle = t('hero.audit.subtitle');
  } else {
    heroTitle = t('hero.awaiting.title', { step: formatStepForSummary(activeStep) });
    heroSubtitle = insight.reason;
  }

  if (!state.lastError && txPipeline.submitted > 0) {
    heroSubtitle = t('hero.txPending', {
      subtitle: heroSubtitle,
      count: txPipeline.submitted,
    });
  }

  setTruncatedText(el.heroTitle, heroTitle, HERO_TITLE_MAX_CHARS);
  setTruncatedText(el.heroSubtitle, heroSubtitle, HERO_SUBTITLE_MAX_CHARS);

  if (el.storyEnergy) animateValue(el.storyEnergy, totalReduction, 'kWh', 600);
  if (el.storyPayout) animateValue(el.storyPayout, totalPayout, 'DRT', 600);
  if (el.storyAudit) {
    if (!auditRequested) el.storyAudit.textContent = displayStatus('pending');
    else el.storyAudit.textContent = auditMatch ? t('status.pass') : t('status.mismatch');
  }
  if (el.storyChallenge) {
    const challengeStatus = deriveChallengeStatus(ui);
    const chipState = challengeChipState(challengeStatus);
    el.storyChallenge.textContent = formatChallengeStatus(challengeStatus);
    el.storyChallenge.className = `status-chip status-chip--mini ${chipState}`;
  }
  if (el.storyLatencyLine) el.storyLatencyLine.textContent = buildStoryLatencyLine();
}

function renderStoryEvidenceRow() {
  if (!el.storyLatestTxLine || !el.storyLatestTxLink) return;

  const latestTx = getLatestTxHash();
  const mode = state.judgeSummary?.network_mode || state.chainMode || '';
  const baseUrl = explorerTxBaseUrl(mode);

  if (!latestTx) {
    el.storyLatestTxLink.textContent = t('story.latestTxNone');
    el.storyLatestTxLink.removeAttribute('href');
    el.storyLatestTxLink.removeAttribute('title');
    el.storyLatestTxLink.classList.add('is-empty');
    return;
  }

  el.storyLatestTxLink.textContent = shortHash(latestTx);
  el.storyLatestTxLink.setAttribute('title', latestTx);
  el.storyLatestTxLink.classList.remove('is-empty');

  if (baseUrl) {
    el.storyLatestTxLink.setAttribute('href', `${baseUrl}${latestTx}`);
  } else {
    el.storyLatestTxLink.removeAttribute('href');
  }
}

function setVisualBarWidth(node, ratio) {
  if (!node) return;
  const pct = Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio)) : 0;
  node.style.width = `${pct}%`;
}

function setPayoutBarState(node, stateName) {
  if (!node) return;
  node.classList.remove('positive', 'negative', 'zero');
  node.classList.add(stateName);
}

function renderVisualInsights() {
  if (!el.visualInsights || !el.visualGrid || !el.visualEmpty) return;

  const proofA = state.proofs['site-a'] || null;
  const proofB = state.proofs['site-b'] || null;
  const settlementA = state.settlements.find((row) => row.site_id === 'site-a') || null;
  const settlementB = state.settlements.find((row) => row.site_id === 'site-b') || null;

  const hasProofData = !!proofA || !!proofB;
  const hasPayoutData =
    (settlementA && Number.isFinite(Number(settlementA.payout))) ||
    (settlementB && Number.isFinite(Number(settlementB.payout)));
  const hasBaselineComparison = !!state.baselineComparison;
  const shouldShow =
    hasProofData ||
    hasPayoutData ||
    (state.viewMode === 'engineering' && hasBaselineComparison);

  el.visualInsights.classList.toggle('hidden', !shouldShow);
  el.visualEmpty.classList.toggle('hidden', shouldShow);
  el.visualGrid.classList.toggle('hidden', !shouldShow);
  if (!shouldShow) return;

  const baselineSummary = getBaselineConfidenceSummary();
  if (el.visualConfidenceWeight) {
    if (baselineSummary.confidence == null) {
      el.visualConfidenceWeight.textContent = t('visual.pending');
    } else {
      el.visualConfidenceWeight.textContent = `${Math.round(baselineSummary.confidence * 100)}%`;
    }
  }
  if (el.visualConfidenceMethod) {
    const label = t('visual.confidenceMethod');
    const methodText = baselineSummary.method || '--';
    el.visualConfidenceMethod.textContent = `${label}: ${methodText}`;
  }

  const maxKwh = Math.max(
    Number(proofA?.baseline_kwh || 0),
    Number(proofA?.actual_kwh || 0),
    Number(proofB?.baseline_kwh || 0),
    Number(proofB?.actual_kwh || 0),
    1
  );

  function renderProofBars(proof, baselineBar, actualBar, baselineText, actualText, reductionText) {
    if (!proof) {
      setVisualBarWidth(baselineBar, 0);
      setVisualBarWidth(actualBar, 0);
      if (baselineText) baselineText.textContent = '--';
      if (actualText) actualText.textContent = '--';
      if (reductionText) reductionText.textContent = `${t('visual.reduction')}: ${t('visual.pending')}`;
      return;
    }

    const baseline = Number(proof.baseline_kwh || 0);
    const actual = Number(proof.actual_kwh || 0);
    const reduction = Number(proof.reduction_kwh ?? Math.max(0, baseline - actual));
    const ratio = baseline > 0 ? Math.round((reduction / baseline) * 100) : 0;

    setVisualBarWidth(baselineBar, (baseline / maxKwh) * 100);
    setVisualBarWidth(actualBar, (actual / maxKwh) * 100);

    if (baselineText) baselineText.textContent = formatKwh(baseline);
    if (actualText) actualText.textContent = formatKwh(actual);
    if (reductionText) reductionText.textContent = `${t('visual.reduction')}: ${formatKwh(reduction)} (${ratio}%)`;
  }

  renderProofBars(
    proofA,
    el.visSiteABaselineBar,
    el.visSiteAActualBar,
    el.visSiteABaselineText,
    el.visSiteAActualText,
    el.visSiteAReduction
  );
  renderProofBars(
    proofB,
    el.visSiteBBaselineBar,
    el.visSiteBActualBar,
    el.visSiteBBaselineText,
    el.visSiteBActualText,
    el.visSiteBReduction
  );

  const payoutA = settlementA && Number.isFinite(Number(settlementA.payout)) ? Number(settlementA.payout) : null;
  const payoutB = settlementB && Number.isFinite(Number(settlementB.payout)) ? Number(settlementB.payout) : null;
  const maxAbsPayout = Math.max(Math.abs(payoutA || 0), Math.abs(payoutB || 0), 1);

  function renderPayout(barNode, valueNode, payout) {
    if (payout === null) {
      setVisualBarWidth(barNode, 0);
      setPayoutBarState(barNode, 'zero');
      if (valueNode) valueNode.textContent = t('visual.pending');
      return;
    }

    const ratio = payout === 0 ? 6 : Math.max(10, Math.round((Math.abs(payout) / maxAbsPayout) * 100));
    setVisualBarWidth(barNode, ratio);
    if (payout > 0) setPayoutBarState(barNode, 'positive');
    else if (payout < 0) setPayoutBarState(barNode, 'negative');
    else setPayoutBarState(barNode, 'zero');
    if (valueNode) valueNode.textContent = formatSignedPayout(payout);
  }

  renderPayout(el.visPayoutSiteABar, el.visPayoutSiteAValue, payoutA);
  renderPayout(el.visPayoutSiteBBar, el.visPayoutSiteBValue, payoutB);
}

function renderTechnicalEvidence() {
  if (state.viewMode === 'engineering') state.evidenceOpen = true;
  if (state.viewMode !== 'engineering' && !state.evidenceOpen) {
    el.technicalEvidence.classList.add('collapsed');
  } else {
    el.technicalEvidence.classList.toggle('collapsed', !state.evidenceOpen);
  }
  el.evidenceToggle.textContent = state.evidenceOpen ? t('evidence.toggleClose') : t('evidence.toggleOpen');
  el.evidenceToggle.setAttribute('aria-expanded', String(state.evidenceOpen));
}

function applyActionGuards(ui) {
  const hasEvent = !!state.event;
  const requiredSites = ui.requiredSites;
  const requiresSiteA = requiredSites.includes('site-a');
  const requiresSiteB = requiredSites.includes('site-b');

  setButtonState('btnCreate', !state.busy, state.busy ? t('hint.actionInProgress') : '');
  setButtonState(
    'btnProofA',
    !state.busy && hasEvent && requiresSiteA && !state.proofs['site-a'],
    !requiresSiteA
      ? t('hint.proofANotRequired')
      : !hasEvent
      ? t('hint.createEventFirst')
      : t('hint.proofAAlready'),
  );
  setButtonState(
    'btnProofB',
    !state.busy && hasEvent && requiresSiteB && !state.proofs['site-b'],
    !requiresSiteB
      ? t('hint.proofBNotRequired')
      : !hasEvent
      ? t('hint.createEventFirst')
      : t('hint.proofBAlready'),
  );
  setButtonState(
    'btnClose',
    !state.busy && hasEvent && ui.proofsDone && !ui.closeDone,
    ui.proofsDone ? t('hint.eventClosedOrBusy') : t('hint.submitProofsFirst'),
  );
  setButtonState(
    'btnSettle',
    !state.busy && hasEvent && ui.closeDone && !ui.settleDone,
    ui.closeDone ? t('hint.settlementDoneOrBusy') : t('hint.closeEventFirst'),
  );
  setButtonState(
    'btnClaimA',
    !state.busy && ui.settleDone && !ui.claimDone,
    ui.settleDone ? t('hint.claimDoneOrBusy') : t('hint.settleFirst'),
  );
  setButtonState('btnRunAll', !state.busy, state.busy ? t('hint.actionInProgress') : '');
  setButtonState('btnRunAllHero', !state.busy, state.busy ? t('hint.actionInProgress') : '');
  setButtonState(
    'btnNextStep',
    !state.busy && ui.currentStep !== 'completed',
    ui.currentStep === 'completed' ? t('hint.flowCompleted') : t('hint.actionInProgress'),
  );
  setButtonState('btnGetEvent', !state.busy && hasEvent, hasEvent ? t('hint.actionInProgress') : t('hint.createEventFirst'));
  setButtonState(
    'btnGetRecords',
    !state.busy && ui.settleDone,
    ui.settleDone ? t('hint.actionInProgress') : t('hint.settleFirst'),
  );
  setButtonState('btnAudit', !state.busy && hasEvent, hasEvent ? t('hint.actionInProgress') : t('hint.createEventFirst'));
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
  refreshToggleText();
  if (el.btnCameraMode) el.btnCameraMode.setAttribute('aria-pressed', String(state.cameraMode));
  renderAll();
}

function renderCrosschainTab() {
  if (el.bridgeTransfersBody) {
    if (state.bridgeTransfers.length === 0) {
      el.bridgeTransfersBody.innerHTML = `<tr><td colspan="5" class="empty-row empty-row-guided"><span class="empty-icon">&#x21C6;</span><span>${t('crosschain.noTransfersGuide')}</span></td></tr>`;
    } else {
      el.bridgeTransfersBody.innerHTML = state.bridgeTransfers.map(tx => {
        const dir = tx.direction === 'home_to_remote' ? 'Home \u2192 Remote' : 'Remote \u2192 Home';
        const sc = tx.status === 'completed' ? 'done' : (tx.status === 'initiated' ? 'pending' : 'in-progress');
        return `<tr>
          <td>${dir}</td>
          <td class="mono">${tx.amount_wei} wei</td>
          <td><span class="status-chip ${sc}">${tx.status}</span></td>
          <td class="mono">${tx.source_tx_hash ? tx.source_tx_hash.slice(0, 10) + '\u2026' : '--'}</td>
          <td class="mono">${tx.dest_tx_hash ? tx.dest_tx_hash.slice(0, 10) + '\u2026' : '--'}</td>
        </tr>`;
      }).join('');
    }
  }
  if (el.icmMessagesBody) {
    if (state.icmMessages.length === 0) {
      el.icmMessagesBody.innerHTML = `<tr><td colspan="4" class="empty-row empty-row-guided"><span class="empty-icon">&#x21C6;</span><span>${t('crosschain.noMessagesGuide')}</span></td></tr>`;
    } else {
      el.icmMessagesBody.innerHTML = state.icmMessages.map(msg => {
        const typeLabel = msg.message_type.replace(/_/g, ' ');
        const sc = msg.status === 'processed' ? 'done' : (msg.status === 'failed' ? 'error' : 'pending');
        return `<tr>
          <td><span class="icm-type-badge">${typeLabel}</span></td>
          <td>${msg.source_chain} \u2192 ${msg.dest_chain}</td>
          <td><span class="status-chip ${sc}">${msg.status}</span></td>
          <td class="mono">${msg.sender.slice(0, 10)}\u2026</td>
        </tr>`;
      }).join('');
    }
  }
  if (el.bridgeStatsTotal) el.bridgeStatsTotal.textContent = state.bridgeStats.total_transfers;
  if (el.bridgeStatsPending) el.bridgeStatsPending.textContent = state.bridgeStats.pending_count;
  if (el.bridgeStatsCompleted) el.bridgeStatsCompleted.textContent = state.bridgeStats.completed_count;
  if (el.icmStatsTotal) el.icmStatsTotal.textContent = state.icmStats.total_messages;
  if (el.icmStatsPending) {
    const pending = (state.icmStats.by_status || {}).pending || 0;
    el.icmStatsPending.textContent = pending;
  }
  renderStoryCrosschainSummary();
}

function renderStoryCrosschainSummary() {
  const bp = state.bridgeStats.pending_count;
  const ip = (state.icmStats.by_status || {}).pending || 0;
  const bt = state.bridgeStats.total_transfers;
  const it = state.icmStats.total_messages;
  const hasData = bt > 0 || it > 0;

  if (el.storyCcBridgeValue) {
    if (hasData || bp > 0) {
      el.storyCcBridgeValue.classList.add('cc-connected');
      el.storyCcBridgeValue.textContent = bp > 0 ? `${bp} pending` : 'idle';
      el.storyCcBridgeValue.className = `value${bp > 0 ? ' status-warn cc-connected' : ' cc-connected'}`;
    }
  }
  if (el.storyCcIcmValue) {
    if (hasData || ip > 0) {
      el.storyCcIcmValue.classList.add('cc-connected');
      el.storyCcIcmValue.textContent = ip > 0 ? `${ip} pending` : 'idle';
      el.storyCcIcmValue.className = `value${ip > 0 ? ' status-warn cc-connected' : ' cc-connected'}`;
    }
  }
  if (el.storyCcBridgeTotal) el.storyCcBridgeTotal.textContent = bt;
  if (el.storyCcIcmTotal) el.storyCcIcmTotal.textContent = it;
  if (el.storyCcHint) {
    el.storyCcHint.style.display = hasData ? 'none' : '';
  }
}

function buildBaselineComparisonFallback() {
  const baselines = Object.values(state.proofs)
    .map((proof) => Number(proof?.baseline_kwh || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const base = baselines.length
    ? baselines.reduce((sum, value) => sum + value, 0) / baselines.length
    : 150;
  const roundKwh = (value) => Math.round(value * 10) / 10;
  const results = [
    { method: 'simple', baseline_kwh: roundKwh(base), confidence: 0.85 },
    { method: 'ewma', baseline_kwh: roundKwh(base * 0.94), confidence: 0.9 },
    { method: 'percentile', baseline_kwh: roundKwh(base * 0.88), confidence: 0.75 },
  ];
  const recommended = results.reduce((best, item) => (item.confidence > best.confidence ? item : best), results[0]);
  return { results, recommended, source: 'local' };
}

function buildBaselineHistoryPayload() {
  const proofs = Object.values(state.proofs);
  const baselineValues = proofs
    .map((proof) => Number(proof?.baseline_kwh || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const now = new Date();
  const eventHour = state.event?.start_time
    ? new Date(state.event.start_time).getUTCHours()
    : now.getUTCHours();
  const base = baselineValues.length
    ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length
    : 150;

  const history = [];
  for (let day = 7; day >= 1; day -= 1) {
    const ts = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - day,
      eventHour,
      0,
      0
    ));
    const jitter = ((day % 3) - 1) * 0.04;
    const kw = Math.max(1, base * (1 + jitter));
    history.push({ timestamp: ts.toISOString(), kw: Number(kw.toFixed(2)) });
  }
  return { history, event_hour: eventHour };
}

async function requestBaselineComparison() {
  const proofCount = Object.keys(state.proofs).length;
  if (!proofCount) return;
  const key = `${state.event?.event_id || 'none'}:${proofCount}`;
  if (baselineState.lastKey === key && state.baselineComparison) {
    renderBaselineComparison();
    renderVisualInsights();
    return;
  }
  baselineState.lastKey = key;

  const payload = buildBaselineHistoryPayload();
  if (!payload.history.length) {
    state.baselineComparison = buildBaselineComparisonFallback();
    state.baselineResult = state.baselineComparison.recommended || null;
    renderBaselineComparison();
    renderVisualInsights();
    return;
  }

  try {
    const c = cfg();
    const data = await callApi(
      '/v1/baseline/compare',
      'POST',
      payload,
      c.operatorKey,
      'ui-agent',
      { trackStepTiming: false }
    );
    state.baselineComparison = { ...data, source: 'api' };
    state.baselineResult = data.recommended || null;
  } catch (_) {
    state.baselineComparison = buildBaselineComparisonFallback();
    state.baselineResult = state.baselineComparison.recommended || null;
  }
  renderBaselineComparison();
  renderVisualInsights();
}

function refreshBaselineComparison() {
  const proofCount = Object.keys(state.proofs).length;
  const key = `${state.event?.event_id || 'none'}:${proofCount}`;
  if (baselineState.lastKey === key && state.baselineComparison) return;
  baselineState.lastKey = key;
  if (state.baselineComparison && state.baselineComparison.source === 'api') {
    state.baselineResult = state.baselineComparison.recommended || null;
    renderBaselineComparison();
    return;
  }
  state.baselineComparison = buildBaselineComparisonFallback();
  state.baselineResult = state.baselineComparison.recommended || null;
  renderBaselineComparison();
}

function renderBaselineComparison() {
  const card = document.getElementById('visualBaselineCard');
  const container = document.getElementById('baselineMethodRows');
  if (!card || !container) return;
  if (!state.baselineComparison) return;
  if (el.baselineMockPreview) el.baselineMockPreview.classList.add('has-data');
  const { results, recommended } = state.baselineComparison;
  if (!results || results.length === 0) return;
  const maxKwh = Math.max(...results.map(r => r.baseline_kwh));
  container.innerHTML = results.map(r => {
    const pct = maxKwh > 0 ? (r.baseline_kwh / maxKwh * 100) : 0;
    const isRec = r.method === recommended.method;
    return `<div class="baseline-method-row ${isRec ? 'recommended' : ''}">
      <div class="baseline-method-label">
        <span class="baseline-method-name">${r.method}${isRec ? ' \u2605' : ''}</span>
        <span class="baseline-confidence">${(r.confidence * 100).toFixed(0)}%</span>
      </div>
      <div class="baseline-bar-track">
        <div class="baseline-bar-fill" style="width: ${pct.toFixed(1)}%"></div>
      </div>
      <span class="baseline-value mono">${r.baseline_kwh.toFixed(1)} kWh</span>
    </div>`;
  }).join('');
}

async function refreshCrosschainData() {
  const { operatorKey } = cfg();
  try {
    const resp = await fetch(`${cfg().baseUrl}/v1/dashboard/summary`, {
      headers: { 'x-api-key': operatorKey, 'x-actor-id': 'ui-user', 'Content-Type': 'application/json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      state.dashboardSummary = data;
      state.bridgeStats = data.bridge || state.bridgeStats;
      state.icmStats = data.icm || state.icmStats;
    }
  } catch (_) { /* silent */ }
  try {
    const resp = await fetch(`${cfg().baseUrl}/v1/bridge/transfers/pending`, {
      headers: { 'x-api-key': operatorKey, 'x-actor-id': 'ui-user', 'Content-Type': 'application/json' },
    });
    if (resp.ok) state.bridgeTransfers = await resp.json();
  } catch (_) { /* silent */ }
  try {
    const resp = await fetch(`${cfg().baseUrl}/v1/icm/messages/pending`, {
      headers: { 'x-api-key': operatorKey, 'x-actor-id': 'ui-user', 'Content-Type': 'application/json' },
    });
    if (resp.ok) state.icmMessages = await resp.json();
  } catch (_) { /* silent */ }
  renderCrosschainTab();
}

function renderAll() {
  const ui = deriveUiState();
  renderStaticI18n();
  renderViewMode();
  renderMissionStrip(ui);
  renderStoryHero(ui);
  renderStoryEvidenceRow();
  refreshBaselineComparison();
  renderVisualInsights();
  renderFlowTimeline(ui);
  renderKpiGrid(ui);
  renderEvidenceDeck(ui);
  renderErrorCard(ui);
  renderSnapshotFeedback();
  applyActionGuards(ui);
  applyCameraMode(ui);
  renderTechnicalEvidence();
  renderCrosschainTab();
}

function localizeLogLabel(label) {
  if (label === 'ready') return t('log.ready');
  if (label === 'run') return t('log.run');
  if (label === 'error') return t('log.error');
  if (label === 'create event ok') return t('log.createOk');
  if (label === 'close event ok') return t('log.closeOk');
  if (label === 'settle ok') return t('log.settleOk');
  if (label === 'claim site-a ok') return t('log.claimOk');
  if (label === 'event detail') return t('log.eventDetail');
  if (label === 'settlement records') return t('log.records');
  if (label === 'audit record') return t('log.audit');
  if (label === 'snapshot export') return t('log.snapshotExport');
  if (label === 'snapshot export fallback') return t('log.snapshotFallback');
  const proofMatched = label.match(/^submit proof (.+) ok$/);
  if (proofMatched) return t('log.proofOk', { site: proofMatched[1] });
  return label;
}

function appendLog(label, payload) {
  const entry = `[${new Date().toISOString()}] ${localizeLogLabel(label)}\n${
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  }`;
  state.logEntries.push(entry);
  const overflow = Math.max(0, state.logEntries.length - MAX_LOG_ENTRIES);
  if (overflow > 0) {
    state.logEntries.splice(0, overflow);
  }

  const prefix = overflow > 0 ? `${t('log.trimmedPrefix')}\n\n` : '';
  el.log.textContent = `${prefix}${state.logEntries.join('\n\n')}\n`;
  el.log.scrollTop = el.log.scrollHeight;
  state.lastAction = localizeLogLabel(label);
  renderAll();
}

function plusMinutes(mins) {
  const d = new Date(Date.now() + mins * 60 * 1000);
  return d.toISOString().replace('.000', '');
}

function isClosePendingConfirmationError(err) {
  const text = String(err?.message || err || '').toLowerCase();
  return (
    text.includes('close_tx_pending_confirmation') ||
    text.includes('event_not_closed_onchain') ||
    text.includes('close transaction still pending confirmation')
  );
}

function isCreatePendingConfirmationError(err) {
  const text = String(err?.message || err || '').toLowerCase();
  return (
    text.includes('create_tx_pending_confirmation') ||
    text.includes('create transaction is submitted but not confirmed yet')
  );
}

function isSettlePendingConfirmationError(err) {
  const text = String(err?.message || err || '').toLowerCase();
  return (
    text.includes('settle_tx_pending_confirmation') ||
    text.includes('settlement transaction still pending confirmation')
  );
}

async function callApi(path, method, body, apiKey, actorId = 'ui-user', options = {}) {
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
    if (state.timing.current && options.trackStepTiming !== false) {
      state.timing.current.apiMs = state.lastLatencyMs;
      state.timing.current.apiPath = `${method} ${path}`;
    }
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
    const detail = data && typeof data === 'object'
      ? data.message || data.detail || ''
      : String(data || '');
    const suffix = detail ? ` - ${detail}` : '';
    throw new Error(`${method} ${path} failed: ${code}${suffix}`);
  }

  return data;
}

async function refreshChainMode() {
  const c = cfg();
  try {
    const data = await callApi('/system/chain-mode', 'GET', null, c.auditorKey, 'auditor-1', {
      trackStepTiming: false,
    });
    state.chainMode = data.mode || 'unknown';
    state.txConfirmMode = data.tx_confirm_mode || 'hybrid';
    if (Array.isArray(data.required_sites) && data.required_sites.length > 0) {
      state.requiredSites = data.required_sites;
    } else {
      state.requiredSites = [...DEFAULT_REQUIRED_PROOF_SITES];
    }
  } catch (_) {
    state.chainMode = 'unknown';
    state.txConfirmMode = 'hybrid';
    state.requiredSites = [...DEFAULT_REQUIRED_PROOF_SITES];
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
  state.baselineComparison = null;
  state.baselineResult = null;
  baselineState.lastKey = null;
}

function normalizeTxFromPayload(payload) {
  if (!payload) return { txState: '', txHash: '' };
  if (Array.isArray(payload)) {
    const candidate = payload.find((row) => row && row.tx_hash) || payload[0] || null;
    if (!candidate) return { txState: '', txHash: '' };
    return {
      txState: normalizeTxState(candidate.tx_state, candidate.tx_fee_wei),
      txHash: candidate.tx_hash || '',
    };
  }
  if (payload.claim_tx_hash) {
    return {
      txState: normalizeTxState(payload.claim_tx_state, payload.claim_tx_fee_wei),
      txHash: payload.claim_tx_hash || '',
    };
  }
  if (payload.close_tx_hash) {
    return {
      txState: normalizeTxState(payload.close_tx_state, payload.close_tx_fee_wei),
      txHash: payload.close_tx_hash || '',
    };
  }
  return {
    txState: normalizeTxState(payload.tx_state, payload.tx_fee_wei),
    txHash: payload.tx_hash || '',
  };
}

async function refreshSummaryForStep(deferSummary) {
  if (deferSummary) {
    setStepTimingPhase(t('timing.deferSummary'));
    return { summaryMs: null, deferredSummary: true };
  }
  setStepTimingPhase(t('timing.refreshSummary'));
  const startedAt = performance.now();
  await refreshJudgeSummary();
  return { summaryMs: performance.now() - startedAt, deferredSummary: false };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPendingConfirmationsBefore(
  stepId,
  timeoutMs = PENDING_TX_WAIT_TIMEOUT_MS,
  pollMs = PENDING_TX_POLL_MS
) {
  if (!shouldWaitForHybridConfirm()) return;

  let txPipeline = collectTxPipeline();
  if (txPipeline.submitted <= 0) return;

  const startedAt = performance.now();
  while (txPipeline.submitted > 0) {
    setStepTimingPhase(t('timing.awaitingTxConfirm', { count: txPipeline.submitted }));
    await sleep(pollMs);
    await refreshJudgeSummary();
    txPipeline = collectTxPipeline();

    if (txPipeline.failed > 0) {
      throw new Error(
        `pending chain confirmation failed before ${stepLabel(stepId)}: ${txPipeline.failed} failed`
      );
    }
    if (performance.now() - startedAt > timeoutMs) {
      const seconds = Math.round(timeoutMs / 1000);
      throw new Error(
        `pending chain confirmation timeout after ${seconds}s before ${stepLabel(stepId)}: ${txPipeline.submitted} still submitted`
      );
    }
  }
}

function buildTimingNextLine(lastStep, txPipeline) {
  const summaryPart = lastStep.deferredSummary
    ? t('diag.delayBreakdown.summaryDeferred')
    : t('diag.delayBreakdown.summary', { summary: formatMs(lastStep.summaryMs) });
  const txPart = lastStep.txHash
    ? `${displayStatus(lastStep.txState || 'submitted')} ${shortHash(lastStep.txHash)}`
    : t('label.noTxHash');
  const pendingPart =
    txPipeline.submitted > 0
      ? t('diag.delayBreakdown.pending', { count: txPipeline.submitted })
      : txPipeline.failed > 0
        ? t('diag.delayBreakdown.failed', { count: txPipeline.failed })
        : t('diag.delayBreakdown.nonePending');
  return t('diag.delayBreakdown.next', {
    total: formatMs(lastStep.totalMs),
    api: formatMs(lastStep.apiMs),
    summaryPart,
    tx: txPart,
    pendingPart,
  });
}

function buildStoryLatencyLine() {
  const txPipeline = collectTxPipeline();
  if (state.busy && state.timing.current) {
    const current = state.timing.current;
    return t('story.latency.running', {
      step: formatStepForSummary(current.stepId),
      elapsed: formatMs(performance.now() - current.startedAt),
      api: formatMs(current.apiMs),
    });
  }

  if (state.timing.last) {
    const lastStep = state.timing.last;
    const summaryPart = lastStep.deferredSummary
      ? t('diag.delayBreakdown.summaryDeferred')
      : t('diag.delayBreakdown.summary', { summary: formatMs(lastStep.summaryMs) });
    const pendingPart =
      txPipeline.submitted > 0
        ? t('diag.delayBreakdown.pending', { count: txPipeline.submitted })
        : txPipeline.failed > 0
          ? t('diag.delayBreakdown.failed', { count: txPipeline.failed })
          : t('diag.delayBreakdown.nonePending');
    return t('story.latency.breakdown', {
      step: formatStepForSummary(lastStep.stepId),
      api: formatMs(lastStep.apiMs),
      summary: summaryPart,
      total: formatMs(lastStep.totalMs),
      pending: pendingPart,
    });
  }

  if (txPipeline.submitted > 0) {
    return t('story.latency.pendingOnly', { count: txPipeline.submitted });
  }

  return t('story.latency.idle');
}

function buildDiagnosticsView(ui) {
  if (state.lastError) return state.errorView;

  const txPipeline = collectTxPipeline();
  if (state.busy && state.timing.current) {
    const current = state.timing.current;
    const elapsed = performance.now() - current.startedAt;
    return {
      level: 'ok',
      headline: t('diag.running.headline', { step: formatStepForSummary(current.stepId) }),
      hint: t('diag.running.hint', { phase: current.phase || '...' }),
      next: t('diag.running.next', {
        elapsed: formatMs(elapsed),
        api: formatMs(current.apiMs),
        mode: state.txConfirmMode,
      }),
    };
  }

  if (state.timing.last) {
    const lastStep = state.timing.last;
    const apiPath = lastStep.apiPath ? ` (${lastStep.apiPath})` : '';
    return {
      level: 'ok',
      headline: t('diag.delayBreakdown.headline', {
        step: formatStepForSummary(lastStep.stepId),
        path: apiPath,
      }),
      hint: t('diag.delayBreakdown.hint', {
        api: formatMs(lastStep.apiMs),
        summary: lastStep.deferredSummary
          ? t('diag.delayBreakdown.summaryDeferred')
          : t('diag.delayBreakdown.summary', { summary: formatMs(lastStep.summaryMs) }),
        total: formatMs(lastStep.totalMs),
      }),
      next: buildTimingNextLine(lastStep, txPipeline),
    };
  }

  if (txPipeline.submitted > 0) {
    return {
      level: 'ok',
      headline: t('diag.waitingConfirm.headline'),
      hint: t('diag.waitingConfirm.hint', { count: txPipeline.submitted }),
      next: t('diag.waitingConfirm.next', { mode: state.txConfirmMode }),
    };
  }

  return makeDefaultErrorView();
}

async function createEvent(options = {}) {
  const c = cfg();
  const payload = {
    event_id: c.eventId,
    start_time: plusMinutes(1),
    end_time: plusMinutes(61),
    target_kw: 200,
    reward_rate: 10,
    penalty_rate: 5,
  };
  startStepTiming('create', t('timing.submitCreate'));
  const data = await callApi('/events', 'POST', payload, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('create');
  resetForNewEvent();
  state.event = data;
  markTransition();
  const tx = normalizeTxFromPayload(data);
  if (tx.txState === 'submitted') {
    setStepTimingPhase(t('timing.txBroadcast'));
  }
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    ...tx,
  });
  appendLog('create event ok', data);
}

async function submitProof(siteId, baseline, actual, options = {}) {
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
  startStepTiming('proofs', t('timing.submitProof', { site: siteDisplay(siteId) }));
  const data = await callApi('/proofs', 'POST', payload, c.participantKey, siteId);
  clearErrorState();
  clearStepError('proofs');
  state.proofs[siteId] = data;
  markTransition();
  const tx = normalizeTxFromPayload(data);
  if (tx.txState === 'submitted') {
    setStepTimingPhase(t('timing.proofSubmitted'));
  }
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    ...tx,
  });
  appendLog(`submit proof ${siteId} ok`, data);
  await requestBaselineComparison();
}

function defaultProofScenario(siteId) {
  if (siteId === 'site-a') return { baseline: 150, actual: 40 };
  if (siteId === 'site-b') return { baseline: 150, actual: 120 };
  return { baseline: 150, actual: 100 };
}

async function closeEvent(options = {}) {
  const c = cfg();
  startStepTiming('close', t('timing.submitClose'));
  const data = await callApi(`/events/${c.eventId}/close`, 'POST', null, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('close');
  state.event = data;
  markTransition();
  const tx = normalizeTxFromPayload({
    close_tx_hash: data.close_tx_hash,
    close_tx_state: data.close_tx_state,
    close_tx_fee_wei: data.close_tx_fee_wei,
  });
  if (tx.txState === 'submitted') {
    setStepTimingPhase(t('timing.closeSubmitted'));
  }
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    ...tx,
  });
  appendLog('close event ok', data);
}

async function settleEvent(options = {}) {
  const c = cfg();
  const payload = { site_ids: requiredProofSites() };
  startStepTiming('settle', t('timing.submitSettle'));
  const data = await callApi(`/settle/${c.eventId}`, 'POST', payload, c.operatorKey, 'operator-1');
  clearErrorState();
  clearStepError('settle');
  state.settlements = data;
  if (state.event) state.event.status = 'settled';
  markTransition();
  const tx = normalizeTxFromPayload(data);
  if (tx.txState === 'submitted') {
    setStepTimingPhase(t('timing.settleSubmitted'));
  }
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    ...tx,
  });
  appendLog('settle ok', data);
}

async function claimA(options = {}) {
  const c = cfg();
  startStepTiming('claim', t('timing.submitClaim'));
  const data = await callApi(`/claim/${c.eventId}/site-a`, 'POST', null, c.participantKey, 'site-a');
  clearErrorState();
  clearStepError('claim');
  const idx = state.settlements.findIndex((row) => row.site_id === data.site_id);
  if (idx >= 0) state.settlements[idx] = data;
  else state.settlements.push(data);
  markTransition();
  const tx = normalizeTxFromPayload({
    claim_tx_hash: data.claim_tx_hash,
    claim_tx_state: data.claim_tx_state,
    claim_tx_fee_wei: data.claim_tx_fee_wei,
  });
  if (tx.txState === 'submitted') {
    setStepTimingPhase(t('timing.claimSubmitted'));
  }
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    ...tx,
  });
  appendLog('claim site-a ok', data);
}

async function getEvent(options = {}) {
  const c = cfg();
  startStepTiming('create', t('timing.fetchEvent'));
  const data = await callApi(`/events/${c.eventId}`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  state.event = data;
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    txState: 'read',
  });
  appendLog('event detail', data);
}

async function getRecords(options = {}) {
  const c = cfg();
  startStepTiming('settle', t('timing.fetchRecords'));
  const data = await callApi(`/events/${c.eventId}/records`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  state.settlements = data;
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    txState: 'read',
  });
  appendLog('settlement records', data);
}

async function getAudit(options = {}) {
  const c = cfg();
  startStepTiming('audit', t('timing.requestAudit'));
  const data = await callApi(`/audit/${c.eventId}/${c.auditSiteId}`, 'GET', null, c.auditorKey, 'auditor-1');
  clearErrorState();
  clearStepError('audit');
  state.audit = data;
  markTransition();
  const refreshTiming = await refreshSummaryForStep(!!options.deferSummary);
  finishStepTiming({
    ...refreshTiming,
    txState: data?.match ? 'verified' : 'mismatch',
  });
  appendLog('audit record', data);
}

async function runFullFlow() {
  appendLog('run', t('log.runStart', { eventId: cfg().eventId }));
  const maxLoops = 18;
  for (let loop = 0; loop < maxLoops; loop += 1) {
    const ui = deriveUiState();
    if (ui.currentStep === 'completed') {
      appendLog('run', t('log.runDone'));
      return;
    }

    if (ui.currentStep === 'create') {
      await createEvent({ deferSummary: true });
      continue;
    }

    if (ui.currentStep === 'proofs') {
      const requiredSites = requiredProofSites();
      let submittedOne = false;
      for (const siteId of requiredSites) {
        if (!state.proofs[siteId]) {
          const scenario = defaultProofScenario(siteId);
          try {
            await submitProof(siteId, scenario.baseline, scenario.actual, {
              deferSummary: true,
            });
            submittedOne = true;
          } catch (err) {
            if (!isCreatePendingConfirmationError(err)) throw err;
            appendLog('run', 'proof waiting for create confirmation; retrying...');
            await sleep(PENDING_TX_POLL_MS);
            await refreshJudgeSummary();
          }
          break;
        }
      }
      if (submittedOne) continue;
      await waitForPendingConfirmationsBefore('proofs');
      continue;
    }

    if (ui.currentStep === 'close') {
      await closeEvent({ deferSummary: true });
      continue;
    }

    if (ui.currentStep === 'settle') {
      await waitForPendingConfirmationsBefore('settle');
      try {
        await settleEvent({ deferSummary: true });
      } catch (err) {
        if (!isClosePendingConfirmationError(err)) throw err;
        appendLog('run', 'settle waiting for close confirmation; retrying...');
        await sleep(PENDING_TX_POLL_MS);
        await refreshJudgeSummary();
      }
      continue;
    }

    if (ui.currentStep === 'claim') {
      await waitForPendingConfirmationsBefore('claim');
      try {
        await claimA({ deferSummary: true });
      } catch (err) {
        if (!isSettlePendingConfirmationError(err)) throw err;
        appendLog('run', 'claim waiting for settlement confirmation; retrying...');
        await sleep(PENDING_TX_POLL_MS);
        await refreshJudgeSummary();
      }
      continue;
    }

    if (ui.currentStep === 'audit') {
      await waitForPendingConfirmationsBefore('audit');
      await getAudit();
      continue;
    }
  }

  throw new Error('run full flow exceeded max retries');
}

function preferredRetryStep() {
  for (const step of FLOW_STEPS) {
    if (state.stepErrors[step.id]) return step.id;
  }
  return endpointToStep(state.lastError);
}

async function runNextStep() {
  const ui = deriveUiState();
  const targetStep = preferredRetryStep() || ui.currentStep;

  if (['proofs', 'settle', 'claim', 'audit'].includes(targetStep)) {
    await waitForPendingConfirmationsBefore(targetStep);
  }

  if (targetStep === 'completed') {
    return;
  }
  if (targetStep === 'create') {
    await createEvent();
    return;
  }
  if (targetStep === 'proofs') {
    for (const siteId of ui.requiredSites) {
      if (!state.proofs[siteId]) {
        const scenario = defaultProofScenario(siteId);
        await submitProof(siteId, scenario.baseline, scenario.actual);
        return;
      }
    }
    if (!ui.requiredSites.length) {
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
    return;
  }
  if (targetStep === 'close') {
    await closeEvent();
    return;
  }
  if (targetStep === 'settle') {
    try {
      await settleEvent();
    } catch (err) {
      if (!isClosePendingConfirmationError(err)) throw err;
      appendLog('run', 'settle waiting for close confirmation; retrying...');
      await sleep(PENDING_TX_POLL_MS);
      await refreshJudgeSummary();
      await settleEvent();
    }
    return;
  }
  if (targetStep === 'claim') {
    try {
      await claimA();
    } catch (err) {
      if (!isSettlePendingConfirmationError(err)) throw err;
      appendLog('run', 'claim waiting for settlement confirmation; retrying...');
      await sleep(PENDING_TX_POLL_MS);
      await refreshJudgeSummary();
      await claimA();
    }
    return;
  }
  if (targetStep === 'audit') {
    await getAudit();
  }
}

function triggerButton(id) {
  const node = document.getElementById(id);
  if (!node || node.disabled) return;
  node.click();
}

function handleActionError(err, fallbackStep) {
  if (
    isCreatePendingConfirmationError(err) ||
    isClosePendingConfirmationError(err) ||
    isSettlePendingConfirmationError(err)
  ) {
    const activeTiming = state.timing.current;
    if (activeTiming) {
      finishStepTiming({
        txState: 'submitted',
        deferredSummary: true,
      });
    }
    if (isCreatePendingConfirmationError(err)) delete state.stepErrors.proofs;
    if (isClosePendingConfirmationError(err)) delete state.stepErrors.settle;
    if (isSettlePendingConfirmationError(err)) delete state.stepErrors.claim;
    clearErrorState();
    appendLog('run', 'deferred: waiting on prior on-chain confirmation');
    return;
  }

  const message = err.message || String(err);
  const activeTiming = state.timing.current;
  if (activeTiming) {
    finishStepTiming({
      txState: 'failed',
      deferredSummary: false,
    });
  }
  state.lastError = message;
  state.errorView = decodeError(message);
  const step = endpointToStep(message) || fallbackStep;
  if (step) {
    state.stepErrors[step] = message;
    state.errorView.next = `${t('error.failedStepPrefix')}: ${stepLabel(step)}. ${t('error.retrySuggestion')}: ${state.errorView.next}`;
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

if (el.btnViewEngineering) {
  el.btnViewEngineering.addEventListener('click', () => {
    applyViewMode('engineering');
    renderAll();
  });
}

if (el.btnLangEn) {
  el.btnLangEn.addEventListener('click', () => {
    applyLanguage('en');
  });
}

if (el.btnLangZh) {
  el.btnLangZh.addEventListener('click', () => {
    applyLanguage('zh');
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

if (el.btnStorySnapshot) {
  el.btnStorySnapshot.addEventListener('click', async () => {
    await exportJudgeSnapshot();
  });
}

if (el.btnStoryTechEvidence) {
  el.btnStoryTechEvidence.addEventListener('click', () => {
    state.evidenceOpen = true;
    applyViewMode('engineering');
    renderAll();
    if (el.technicalEvidence) {
      el.technicalEvidence.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (el.btnCameraMode) {
  el.btnCameraMode.addEventListener('click', toggleCameraMode);
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
bindAction('btnNextStep', runNextStep);
bindAction('btnGetEvent', getEvent, 'create');
bindAction('btnGetRecords', getRecords, 'settle');
bindAction('btnAudit', getAudit, 'audit');

if (el.btnRefreshCrosschain) {
  el.btnRefreshCrosschain.addEventListener('click', refreshCrosschainData);
}

renderAll();
appendLog('ready', t('log.readyMessage'));
refreshChainMode();
refreshJudgeSummary();
refreshCrosschainData();
