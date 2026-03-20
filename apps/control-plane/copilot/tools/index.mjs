// ---------------------------------------------------------------------------
// Copilot tool implementations — bounded product API adapters
// ---------------------------------------------------------------------------
// Each tool queries the real P0 backend (via toolContext.backendFetch) with
// fixture fallback. No tools may mutate state.
// ---------------------------------------------------------------------------

import { registerTool } from '../tool-registry.mjs';

// ---- Helper: fetch from real backend with fallback -------------------------

async function safeBackendFetch(context, path) {
  try {
    const url = `${context.backendUrl}/api/control-plane-admin/v1${path}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      return { ok: true, source: 'real-backend', data };
    }
    return { ok: false, source: 'backend-error', status: resp.status };
  } catch {
    return { ok: false, source: 'backend-unreachable' };
  }
}

function fixtureItems(context, key) {
  return context.fixtures?.[key]?.items || [];
}

// ---- Tool 1: getTenantSummary ----------------------------------------------

registerTool({
  name: 'getTenantSummary',
  description: 'Get a summary of a specific tenant lifecycle posture, or list all tenants if no tenantId is provided.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      tenantId: { type: 'string', description: 'Tenant ID (UUID). Omit to list all tenants.' },
    },
  },
  async handler(params, context) {
    if (params.tenantId) {
      const result = await safeBackendFetch(context, `/tenants/${encodeURIComponent(params.tenantId)}`);
      if (result.ok) return { source: 'real-backend', tenant: result.data };
      // Fallback to fixture
      const fixture = fixtureItems(context, 'tenants').find(t => t.tenantId === params.tenantId);
      if (fixture) return { source: 'fixture-fallback', tenant: fixture };
      return { source: 'not-found', tenant: null };
    }
    // List all
    const result = await safeBackendFetch(context, '/tenants');
    if (result.ok) return { source: 'real-backend', tenants: result.data.items || result.data };
    return { source: 'fixture-fallback', tenants: fixtureItems(context, 'tenants') };
  },
});

// ---- Tool 2: getProvisioningRunSummary -------------------------------------

registerTool({
  name: 'getProvisioningRunSummary',
  description: 'Get a summary of provisioning runs. Optionally filter by tenantId or runId.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      runId: { type: 'string', description: 'Specific provisioning run ID' },
      tenantId: { type: 'string', description: 'Filter runs by tenant ID' },
    },
  },
  async handler(params, context) {
    if (params.runId) {
      let result = await safeBackendFetch(context, `/provisioning/runs/${encodeURIComponent(params.runId)}/steps`);
      if (!result.ok) result = await safeBackendFetch(context, `/provisioning/runs/${encodeURIComponent(params.runId)}`);
      if (result.ok) return { source: 'real-backend', run: result.data };
      const fixture = fixtureItems(context, 'provisioning-runs').find(r => r.provisioningRunId === params.runId);
      if (fixture) return { source: 'fixture-fallback', run: fixture };
      return { source: 'not-found', run: null };
    }
    const result = await safeBackendFetch(context, '/provisioning/runs');
    if (result.ok) {
      let runs = result.data.items || result.data;
      if (params.tenantId) runs = runs.filter(r => r.tenantId === params.tenantId);
      return { source: 'real-backend', runs };
    }
    let runs = fixtureItems(context, 'provisioning-runs');
    if (params.tenantId) runs = runs.filter(r => r.tenantId === params.tenantId);
    return { source: 'fixture-fallback', runs };
  },
});

// ---- Tool 3: getBootstrapStatus --------------------------------------------

registerTool({
  name: 'getBootstrapStatus',
  description: 'Get the status of bootstrap requests. Optionally filter by tenantId or requestId.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      requestId: { type: 'string', description: 'Specific bootstrap request ID' },
      tenantId: { type: 'string', description: 'Filter by tenant ID' },
    },
  },
  async handler(params, context) {
    if (params.requestId) {
      const result = await safeBackendFetch(context, `/bootstrap/requests/${encodeURIComponent(params.requestId)}`);
      if (result.ok) return { source: 'real-backend', request: result.data };
      const fixture = fixtureItems(context, 'bootstrap-requests').find(r => r.bootstrapRequestId === params.requestId);
      if (fixture) return { source: 'fixture-fallback', request: fixture };
      return { source: 'not-found', request: null };
    }
    const result = await safeBackendFetch(context, '/bootstrap/requests');
    if (result.ok) {
      let items = result.data.items || result.data;
      if (params.tenantId) items = items.filter(r => r.tenantId === params.tenantId);
      return { source: 'real-backend', requests: items };
    }
    let items = fixtureItems(context, 'bootstrap-requests');
    if (params.tenantId) items = items.filter(r => r.tenantId === params.tenantId);
    return { source: 'fixture-fallback', requests: items };
  },
});

// ---- Tool 4: getAuditSummary -----------------------------------------------

registerTool({
  name: 'getAuditSummary',
  description: 'Get recent audit trail entries from the control-plane backend. No PHI is present.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max entries to return (default 20)' },
    },
  },
  async handler(params, context) {
    const limit = params.limit || 20;
    const result = await safeBackendFetch(context, `/audit/events?limit=${limit}`);
    if (result.ok) return { source: 'real-backend', events: result.data.items || result.data };
    return { source: 'backend-unreachable', events: [], note: 'Audit trail unavailable — backend not reachable' };
  },
});

// ---- Tool 5: getMarketAndPackResolutionSummary -----------------------------

registerTool({
  name: 'getMarketAndPackResolutionSummary',
  description: 'Get market profiles, pack catalog, and effective plan resolution. Contract-backed data.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      legalMarketId: { type: 'string', description: 'Filter to a specific legal market ID (e.g., US, PH, JP)' },
    },
  },
  async handler(params, context) {
    let markets = context.contractData?.legalMarketProfiles || [];
    let packs = context.contractData?.packs || [];
    let plans = context.contractData?.effectivePlans || [];

    if (params.legalMarketId) {
      markets = markets.filter(m => m.legalMarketId === params.legalMarketId);
      plans = plans.filter(p => p.legalMarketId === params.legalMarketId);
    }

    return {
      source: 'contract-backed',
      markets,
      packCount: packs.length,
      packs: packs.map(p => ({ packId: p.packId, packFamily: p.packFamily, displayName: p.displayName, lifecycleState: p.lifecycleState })),
      planCount: plans.length,
      plans: plans.map(p => ({
        effectivePlanId: p.effectivePlanId,
        legalMarketId: p.legalMarketId,
        resolvedPackCount: (p.resolvedPacks || []).length,
        deferredPackCount: (p.deferredPacks || []).length,
      })),
    };
  },
});

// ---- Tool 6: getRunbookContext ----------------------------------------------

registerTool({
  name: 'getRunbookContext',
  description: 'Retrieve runbook/procedure content for a topic. Available topics: bootstrap, terminal-proof, provisioning, tenant-lifecycle.',
  category: 'read-only',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Runbook topic: bootstrap, terminal-proof, provisioning, tenant-lifecycle',
      },
    },
    required: ['topic'],
  },
  async handler(params) {
    // Runbook content is loaded from repo docs at tool registration time
    // For the review runtime, these are included as inline summaries
    const runbooks = {
      'bootstrap': {
        title: 'Three-Repo Bootstrap Report',
        summary: 'Documents the creation of the three-repo architecture: VistA-Evolved (archived), vista-evolved-platform (control plane), and vista-evolved-vista-distro (VistA distro). Includes exact files migrated, governance docs created, and unresolved questions.',
        steps: ['1. Archive original monorepo', '2. Create platform repo with docs, contracts, config, domain', '3. Create distro repo with upstream, overlay, docker', '4. Establish cross-repo governance (AGENTS.md, decision-index)'],
      },
      'terminal-proof': {
        title: 'Browser Terminal Proof Report',
        summary: 'Documents the proof that xterm.js → WebSocket → SSH → YDB/MUMPS terminal works in-browser. Covers architecture, 7 verified gates, CHSET mismatch risk, and manual reproduction steps.',
        steps: ['1. Start local-vista Docker container', '2. Start terminal-proof WebSocket server', '3. Open browser terminal', '4. Verify MUMPS prompt, patient lookup, menu navigation', '5. Document verified gates and deferred areas'],
      },
      'provisioning': {
        title: 'Provisioning Run Procedure',
        summary: 'A provisioning run executes the 10-step canonical sequence to stand up a tenant: create-pg-schema, seed-config, create-vista-instance, configure-vista, verify-vista, configure-adapters, run-smoke-tests, activate-monitoring, register-dns, mark-complete. Each step has status tracking, blockers, and compensating actions on failure.',
        steps: ['1. Create provisioning run from approved bootstrap request', '2. Queue the run', '3. System executes 10 canonical steps', '4. Monitor step progress and blockers', '5. On failure: identify step, check blocker, remediate, retry or cancel'],
      },
      'tenant-lifecycle': {
        title: 'Tenant Lifecycle Management',
        summary: 'Tenants progress through states: draft → active → suspended ↔ active → archived. Activation requires approved bootstrap + completed provisioning. Suspension requires reason and is reversible. Archive is terminal. Each transition has guards, side effects, and audit logging.',
        steps: ['1. Create tenant (draft)', '2. Bootstrap request (draft → approved)', '3. Provisioning run (queued → completed)', '4. Activate tenant', '5. Suspend/reactivate as needed', '6. Archive when decommissioned (irreversible)'],
      },
    };

    const runbook = runbooks[params.topic];
    if (!runbook) {
      return { source: 'not-found', availableTopics: Object.keys(runbooks), note: `Topic "${params.topic}" not found. Available: ${Object.keys(runbooks).join(', ')}` };
    }
    return { source: 'repo-docs', ...runbook };
  },
});

// ---- Tool 7: draftSupportCaseNote ------------------------------------------

registerTool({
  name: 'draftSupportCaseNote',
  description: 'Draft a support/triage case note for a tenant issue. The draft is NOT persisted — it requires operator review and manual submission.',
  category: 'draft-only',
  parameters: {
    type: 'object',
    properties: {
      tenantId: { type: 'string', description: 'Tenant ID this note is about' },
      issueDescription: { type: 'string', description: 'Description of the issue' },
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Issue severity' },
    },
    required: ['tenantId', 'issueDescription'],
  },
  async handler(params) {
    return {
      source: 'ai-draft',
      draftType: 'support-case-note',
      isAuthoritative: false,
      requiresOperatorReview: true,
      draft: {
        label: '⚠️ AI-ASSISTED DRAFT — Not yet applied. Not authoritative. Requires operator review.',
        tenantId: params.tenantId,
        severity: params.severity || 'medium',
        issueDescription: params.issueDescription,
        timestamp: new Date().toISOString(),
        sections: {
          summary: `Support case for tenant ${params.tenantId}: ${params.issueDescription}`,
          classification: params.severity || 'medium',
          suggestedNextSteps: 'To be populated by copilot based on context gathered from other tools.',
        },
      },
    };
  },
});

// ---- Tool 8: draftOperatorRemediationPlan ----------------------------------

registerTool({
  name: 'draftOperatorRemediationPlan',
  description: 'Draft an operator remediation plan for a provisioning or lifecycle issue. The draft is NOT persisted — it requires operator review.',
  category: 'draft-only',
  parameters: {
    type: 'object',
    properties: {
      tenantId: { type: 'string', description: 'Tenant ID' },
      issue: { type: 'string', description: 'Issue to remediate' },
      context: { type: 'string', description: 'Additional context (run IDs, error messages, etc.)' },
    },
    required: ['issue'],
  },
  async handler(params) {
    return {
      source: 'ai-draft',
      draftType: 'operator-remediation-plan',
      isAuthoritative: false,
      requiresOperatorReview: true,
      draft: {
        label: '⚠️ AI-ASSISTED DRAFT — Not yet applied. Not authoritative. Requires operator review.',
        tenantId: params.tenantId || 'not-specified',
        issue: params.issue,
        additionalContext: params.context || '',
        timestamp: new Date().toISOString(),
        sections: {
          diagnosis: 'To be populated by copilot based on tool queries.',
          impactAssessment: 'To be populated based on tenant and provisioning state.',
          remediationSteps: 'To be populated with specific ordered steps.',
          rollbackPlan: 'To be populated if remediation has risk of side effects.',
          verificationSteps: 'To be populated with steps to confirm remediation success.',
        },
      },
    };
  },
});
