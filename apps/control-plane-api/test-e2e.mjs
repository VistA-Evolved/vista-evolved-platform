/**
 * E2E lifecycle proof script for control-plane-api.
 *
 * Runs against a live API on PORT (default 4511).
 * Proves: health, tenant CRUD+lifecycle, bootstrap, provisioning, audit, guards.
 */
const BASE = `http://127.0.0.1:${process.env.PORT || 4511}`;
const API = `${BASE}/api/control-plane-admin/v1`;

let passed = 0;
let failed = 0;
const evidence = [];

async function req(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function rawReq(url) {
  const res = await fetch(url);
  return { status: res.status, json: await res.json() };
}

function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
    evidence.push({ gate: label, result: 'PASS', detail });
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
    console.error(`    Detail: ${JSON.stringify(detail)}`);
    evidence.push({ gate: label, result: 'FAIL', detail });
  }
}

async function main() {
  console.log('=== Gate 1: Health Check ===');
  const h = await rawReq(`${BASE}/health`);
  check('Health endpoint returns ok', h.json.ok === true, h.json);

  // ===== GATE 2: Migration proof =====
  console.log('\n=== Gate 2: Migration Proof ===');
  // We'll verify via tenant create (requires tables to exist)

  // ===== GATE 3: Tenant lifecycle =====
  console.log('\n=== Gate 3a: Tenant Lifecycle ===');

  // Create tenant
  const t1 = await req('POST', '/tenants', {
    displayName: 'E2E Test Clinic',
    slug: 'e2e-test-clinic',
    legalMarketId: 'US',
    actor: 'e2e-test-agent',
  });
  check('Create tenant → 201', t1.status === 201, t1.json);
  check('Tenant status is draft', t1.json?.tenant?.status === 'draft', t1.json?.tenant?.status);
  const tenantId = t1.json?.tenant?.id;

  // Get tenant
  const t2 = await req('GET', `/tenants/${tenantId}`);
  check('Get tenant → ok', t2.json?.ok === true && t2.json?.tenant?.id === tenantId, t2.json);

  // List tenants
  const t3 = await req('GET', '/tenants');
  check('List tenants has entries', t3.json?.ok === true && t3.json?.tenants?.length >= 1, { count: t3.json?.tenants?.length });

  // Activate tenant (draft → active)
  const t4 = await req('POST', `/tenants/${tenantId}/activate`, { actor: 'e2e-test-agent' });
  check('Activate tenant → ok', t4.json?.ok === true, t4.json);
  check('Tenant status is active', t4.json?.tenant?.status === 'active', t4.json?.tenant?.status);

  // Suspend tenant (active → suspended)
  const t5 = await req('POST', `/tenants/${tenantId}/suspend`, {
    actor: 'e2e-test-agent',
    reason: 'operator-action',
  });
  check('Suspend tenant → ok', t5.json?.ok === true, t5.json);
  check('Tenant status is suspended', t5.json?.tenant?.status === 'suspended', t5.json?.tenant?.status);

  // Reactivate tenant (suspended → active)
  const t6 = await req('POST', `/tenants/${tenantId}/reactivate`, { actor: 'e2e-test-agent' });
  check('Reactivate tenant → ok', t6.json?.ok === true, t6.json);
  check('Tenant status is active after reactivate', t6.json?.tenant?.status === 'active', t6.json?.tenant?.status);

  // Archive tenant (active → archived)
  const t7 = await req('POST', `/tenants/${tenantId}/archive`, { actor: 'e2e-test-agent' });
  check('Archive tenant → ok', t7.json?.ok === true, t7.json);
  check('Tenant status is archived', t7.json?.tenant?.status === 'archived', t7.json?.tenant?.status);

  // Transition history
  const t8 = await req('GET', `/tenants/${tenantId}/transitions`);
  check('Tenant transition history exists', t8.json?.ok === true && t8.json?.transitions?.length >= 4, { count: t8.json?.transitions?.length });

  // ===== GATE 3b: Bootstrap lifecycle =====
  console.log('\n=== Gate 3b: Bootstrap Lifecycle ===');

  // Create draft
  const b1 = await req('POST', '/bootstrap/drafts', {
    tenantName: 'Bootstrap E2E Hospital',
    legalMarketId: 'PH',
    organization: { name: 'E2E Corp', taxId: '123-456' },
    packSelections: ['clinical-core', 'imaging'],
    notes: 'E2E test draft',
    actor: 'e2e-test-agent',
  });
  check('Create bootstrap draft → 201', b1.status === 201, b1.json);
  check('Draft status is draft', b1.json?.draft?.status === 'draft', b1.json?.draft?.status);
  const draftId = b1.json?.draft?.id;

  // Update draft
  const b2 = await req('PATCH', `/bootstrap/drafts/${draftId}`, {
    actor: 'e2e-test-agent',
    notes: 'Updated E2E notes',
  });
  check('Update draft → ok', b2.json?.ok === true, b2.json);

  // Validate draft
  const b3 = await req('POST', `/bootstrap/drafts/${draftId}/validate`, { actor: 'e2e-test-agent' });
  check('Validate draft → ok', b3.json?.ok === true, b3.json);
  check('Draft status is validated', b3.json?.draft?.status === 'validated', b3.json?.draft?.status);

  // Submit for approval
  const b4 = await req('POST', `/bootstrap/drafts/${draftId}/submit`, { actor: 'e2e-test-agent' });
  check('Submit for approval → 201', b4.status === 201, b4.json);
  check('Request created with approval_required status', b4.json?.request?.status === 'approval_required', b4.json?.request?.status);
  const requestId = b4.json?.request?.id;

  // List requests
  const b5 = await req('GET', '/bootstrap/requests');
  check('List requests has entries', b5.json?.ok === true && b5.json?.requests?.length >= 1, { count: b5.json?.requests?.length });

  // Approve request
  const b6 = await req('POST', `/bootstrap/requests/${requestId}/approve`, {
    actor: 'e2e-approver',
    reason: 'E2E test approval',
  });
  check('Approve request → ok', b6.json?.ok === true, b6.json);
  check('Request status is approved', b6.json?.request?.status === 'approved', b6.json?.request?.status);

  // Verify draft was also updated to approved
  const b7 = await req('GET', `/bootstrap/drafts/${draftId}`);
  check('Draft status updated to approved', b7.json?.draft?.status === 'approved', b7.json?.draft?.status);

  // ===== GATE 3c: Provisioning lifecycle =====
  console.log('\n=== Gate 3c: Provisioning Lifecycle ===');

  // Create a second tenant for provisioning test
  const pt = await req('POST', '/tenants', {
    displayName: 'Provisioning Test Clinic',
    slug: 'prov-test-clinic',
    legalMarketId: 'US',
    actor: 'e2e-test-agent',
  });
  const provTenantId = pt.json?.tenant?.id;

  // Create provisioning run
  const p1 = await req('POST', '/provisioning/runs', {
    bootstrapRequestId: requestId,
    tenantId: provTenantId,
    actor: 'e2e-test-agent',
  });
  check('Create provisioning run → 201', p1.status === 201, p1.json);
  check('Run status is draft', p1.json?.run?.status === 'draft', p1.json?.run?.status);
  const runId = p1.json?.run?.id;

  // Get run with steps
  const p2 = await req('GET', `/provisioning/runs/${runId}/steps`);
  check('Run has canonical steps', p2.json?.ok === true && p2.json?.run?.steps?.length === 10, { stepCount: p2.json?.run?.steps?.length });

  // Queue run (draft → queued)
  const p3 = await req('POST', `/provisioning/runs/${runId}/queue`, { actor: 'e2e-test-agent' });
  check('Queue run → ok', p3.json?.ok === true, p3.json);
  check('Run status is queued', p3.json?.run?.status === 'queued', p3.json?.run?.status);

  // Cancel run (queued → cancelled)
  const p4 = await req('POST', `/provisioning/runs/${runId}/cancel`, {
    actor: 'e2e-test-agent',
    reason: 'E2E test cancel',
  });
  check('Cancel run → ok', p4.json?.ok === true, p4.json);
  check('Run status is cancelled', p4.json?.run?.status === 'cancelled', p4.json?.run?.status);

  // List runs
  const p5 = await req('GET', '/provisioning/runs');
  check('List runs has entries', p5.json?.ok === true && p5.json?.runs?.length >= 1, { count: p5.json?.runs?.length });

  // ===== GATE 3d: Audit =====
  console.log('\n=== Gate 3d: Audit & Outbox ===');

  const a1 = await req('GET', '/audit/events?limit=5');
  check('Audit events exist', a1.json?.ok === true && a1.json?.events?.length >= 1, { count: a1.json?.events?.length });

  // Filter by entity
  const a2 = await req('GET', `/audit/events?entityId=${tenantId}`);
  check('Audit events filtered by tenant', a2.json?.ok === true && a2.json?.events?.length >= 4, { count: a2.json?.events?.length });

  // ===== GATE 4: Guard / Concurrency sanity =====
  console.log('\n=== Gate 4: Guard & Concurrency Sanity ===');

  // Invalid transition: archived → active (should fail)
  const g1 = await req('POST', `/tenants/${tenantId}/activate`, { actor: 'e2e-test-agent' });
  check('Archived → active blocked (409)', g1.status === 409 && g1.json?.ok === false, g1.json);

  // Invalid transition: archived → suspended (should fail)
  const g2 = await req('POST', `/tenants/${tenantId}/suspend`, { actor: 'e2e-test-agent', reason: 'operator-action' });
  check('Archived → suspended blocked (409)', g2.status === 409 && g2.json?.ok === false, g2.json);

  // Missing actor (should fail)
  const g3 = await req('POST', '/tenants', { displayName: 'No Actor Test', slug: 'no-actor', legalMarketId: 'US' });
  check('Create without actor → 400', g3.status === 400, g3.json);

  // Duplicate slug test: create tenant with same slug
  const g4 = await req('POST', '/tenants', {
    displayName: 'Dup Test', slug: 'e2e-test-clinic', legalMarketId: 'US', actor: 'e2e-test-agent',
  });
  // Depending on unique constraint, either 400 or 500
  check('Duplicate slug returns error', g4.status >= 400, { status: g4.status, msg: g4.json?.reason || g4.json?.message });

  // Invalid suspension reason
  const freshT = await req('POST', '/tenants', {
    displayName: 'Guard Test Clinic',
    slug: `guard-test-${Date.now()}`,
    legalMarketId: 'US',
    actor: 'e2e-test-agent',
  });
  const guardTenantId = freshT.json?.tenant?.id;
  await req('POST', `/tenants/${guardTenantId}/activate`, { actor: 'e2e-test-agent' });
  const g5 = await req('POST', `/tenants/${guardTenantId}/suspend`, {
    actor: 'e2e-test-agent',
    reason: 'invalid-reason-not-in-enum',
  });
  check('Invalid suspension reason → 409', g5.status === 409 && g5.json?.ok === false, g5.json);

  // Bootstrap: update after validation should fail (status is validated, not draft)
  // Create + validate a new draft
  const gd1 = await req('POST', '/bootstrap/drafts', {
    tenantName: 'Guard Draft Hospital',
    legalMarketId: 'US',
    organization: { name: 'Guard Corp' },
    packSelections: ['clinical-core'],
    actor: 'e2e-test-agent',
  });
  const guardDraftId = gd1.json?.draft?.id;
  await req('POST', `/bootstrap/drafts/${guardDraftId}/validate`, { actor: 'e2e-test-agent' });
  const g6 = await req('PATCH', `/bootstrap/drafts/${guardDraftId}`, {
    actor: 'e2e-test-agent',
    notes: 'Should fail',
  });
  check('Update draft after validation → 409', g6.status === 409, g6.json);

  // Cancel test: create request and cancel it
  const cancelDraft = await req('POST', '/bootstrap/drafts', {
    tenantName: 'Cancel Test Hospital',
    legalMarketId: 'US',
    organization: { name: 'Cancel Corp' },
    packSelections: ['clinical-core'],
    actor: 'e2e-test-agent',
  });
  const cancelDraftId = cancelDraft.json?.draft?.id;
  await req('POST', `/bootstrap/drafts/${cancelDraftId}/validate`, { actor: 'e2e-test-agent' });
  const cancelSubmit = await req('POST', `/bootstrap/drafts/${cancelDraftId}/submit`, { actor: 'e2e-test-agent' });
  const cancelReqId = cancelSubmit.json?.request?.id;
  const g7 = await req('POST', `/bootstrap/requests/${cancelReqId}/cancel`, {
    actor: 'e2e-test-agent',
    reason: 'Testing cancel flow',
  });
  check('Cancel request → ok', g7.json?.ok === true, g7.json);

  // Approve after cancel should fail
  const g8 = await req('POST', `/bootstrap/requests/${cancelReqId}/approve`, {
    actor: 'e2e-test-agent',
  });
  check('Approve cancelled request → 409', g8.status === 409, g8.json);

  // ===== SUMMARY =====
  console.log('\n========================================');
  console.log(`TOTAL: ${passed + failed} checks — ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================');

  // Write evidence JSON
  const fs = await import('node:fs');
  const evidenceDir = 'c:\\Users\\kmoul\\OneDrive\\Documents\\GitHub\\vista-evolved-platform\\artifacts';
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    `${evidenceDir}\\control-plane-e2e-evidence.json`,
    JSON.stringify({ timestamp: new Date().toISOString(), passed, failed, checks: evidence }, null, 2),
  );
  console.log(`\nEvidence written to artifacts/control-plane-e2e-evidence.json`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('E2E script failed:', err);
  process.exit(2);
});
