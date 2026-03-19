# Control-Panel Action Semantics and Source-of-Truth Binding — v2

> **Status:** Draft
> **Scope:** 21 canonical control-plane surfaces (supersedes batch-1 which covered 8)
> **Audience:** Implementation engineers, contract reviewers, QA
> **Not authorized:** This document specifies action binding; it does not authorize runtime implementation.
> **Supersedes:** `control-panel-action-semantics-and-source-of-truth-binding-batch-1.md` (8 surfaces → 21 surfaces)

---

## 1. Purpose

This document is the **master action matrix** binding every operator action across the 21 control-plane surfaces to:

1. **API operation** — the OpenAPI or AsyncAPI operation that fulfills the action
2. **Source of truth** — the authoritative data store or registry
3. **Permission** — the required RBAC permission claim
4. **Precondition** — what must be true before the action is available
5. **Outcome** — what changes in the system after the action completes
6. **Audit event** — what gets logged

### Position in handoff chain

```
Screen contracts → Screen inventory → Page specs v2 → THIS DOCUMENT → Design contract → Implementation
                                                       ↓
                                                 OpenAPI / AsyncAPI contracts
```

### Governing references

| Reference | Location |
|-----------|----------|
| Page specifications v2 | `docs/explanation/control-panel-page-specs-v2.md` |
| Service-map architecture | `docs/explanation/control-plane-service-map-and-operator-console-architecture.md` |
| Tenant lifecycle model | `docs/explanation/control-plane-tenant-lifecycle-and-orchestration-model.md` |
| Information architecture v2 | `docs/explanation/control-panel-information-architecture-and-wireframe-contract-v2.md` |
| OpenAPI contract | `packages/contracts/openapi/control-plane-operator-bootstrap-and-provisioning.openapi.yaml` |
| AsyncAPI contract | `packages/contracts/asyncapi/control-plane-provisioning-events.asyncapi.yaml` |
| Permissions matrix | `docs/reference/permissions-matrix.md` |
| Capability truth | `docs/explanation/capability-truth-and-claim-gating-spec.md` |

---

## 2. Permission model

All 21 control-plane surfaces are restricted to the `platform-operator` role. The permission model expands batch-1's 7 claims to cover the new service domains.

### 2.1 Permission claims

| Permission claim | Grants | Surfaces |
|-----------------|--------|----------|
| `control-plane:read` | View any control-plane surface | All 21 surfaces |
| `control-plane:tenant:bootstrap` | Initiate bootstrap requests | `tenants.bootstrap` |
| `control-plane:provisioning:manage` | Create/retry/cancel provisioning runs | `provisioning.runs` |
| `control-plane:tenant:lifecycle` | Suspend/reactivate/archive tenants | `tenants.detail` |
| `control-plane:config:write` | Modify system configuration | `system.config` |
| `control-plane:packs:write` | Modify pack catalog | `packs.catalog` |
| `control-plane:markets:write` | Modify market profiles | `markets.management` |
| `control-plane:identity:manage` | Manage identities and invitations | `tenants.identity` |
| `control-plane:fleet:manage` | Manage environments, flags, DR | `fleet.environments`, `fleet.backup-dr` |
| `control-plane:fleet:restore` | Initiate restore operations (elevated) | `fleet.backup-dr` (restore only) |
| `control-plane:commerce:manage` | Manage billing, record payments | `commerce.billing` |
| `control-plane:templates:manage` | Create/publish/deprecate templates | `platform.templates` |
| `control-plane:support:manage` | Create/assign/resolve support cases | `platform.support` |
| `control-plane:alerts:manage` | Acknowledge/silence alerts | `platform.alerts` |
| `control-plane:audit:export` | Export audit trail data | `platform.audit` |

### 2.2 Permission notes

- **Read-only surfaces** (`eligibility-simulator`, `commerce.usage`, `platform.audit`, `platform.runbooks`) require only `control-plane:read`
- **`fleet:restore`** is deliberately separated from `fleet:manage` because restore is the highest-risk operator action
- **`commerce:manage`** includes recording payments and triggering subscription suspension — both financially consequential
- **`audit:export`** is separated from read because exports produce external artifacts with compliance implications

---

## 3. Master action matrix

### 3.1 Read actions (data fetching) — Batch 1 surfaces

Carried forward from batch-1 §3.1 with no changes.

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Status |
|---|--------|---------|---------------|------|-----------------|------------|--------|
| R1 | List tenants | `tenants.list` | `listTenants` | `GET /tenants` | platform-tenant-registry | `control-plane:read` | Exists |
| R2 | Get tenant detail | `tenants.detail` | `getTenant` | `GET /tenants/{tenantId}` | platform-tenant-registry | `control-plane:read` | Exists |
| R3 | List bootstrap requests for tenant | `tenants.detail` | `listTenantBootstrapRequests` | `GET /tenant-bootstrap-requests?tenantId={id}` | platform-governance | `control-plane:read` | Exists |
| R4 | Get bootstrap request status | `tenants.bootstrap` | `getTenantBootstrapRequest` | `GET /tenant-bootstrap-requests/{id}` | platform-governance | `control-plane:read` | Exists |
| R5 | Get provisioning run status | `provisioning.runs` | `getProvisioningRun` | `GET /provisioning-runs/{id}` | platform-governance | `control-plane:read` | Exists |
| R6 | List provisioning runs | `provisioning.runs` | `listProvisioningRuns` | `GET /provisioning-runs?bootstrapRequestId={id}` | platform-governance | `control-plane:read` | Exists |
| R7 | Get legal-market profile | `markets.detail` | `getLegalMarketProfile` | `GET /legal-market-profiles/{id}` | claim-readiness-registry | `control-plane:read` | Exists |
| R8 | List legal-market profiles | `markets.management` | `listLegalMarketProfiles` | `GET /legal-market-profiles` | claim-readiness-registry | `control-plane:read` | Exists |
| R9 | List packs | `packs.catalog` | `listPacks` | `GET /packs` | platform-pack-catalog | `control-plane:read` | Exists |
| R10 | Get system config | `system.config` | `getSystemConfig` | `GET /system-config` | platform-system-configuration | `control-plane:read` | Exists |

### 3.2 Read actions — New v2 surfaces

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Status |
|---|--------|---------|---------------|------|-----------------|------------|--------|
| R11 | List identities | `tenants.identity` | `listIdentities` | `GET /identities` | platform-identity-registry | `control-plane:read` | Future |
| R12 | List invitations | `tenants.identity` | `listInvitations` | `GET /invitations` | platform-identity-registry | `control-plane:read` | Future |
| R13 | List payer readiness | `markets.payer-readiness` | `listPayerReadiness` | `GET /payer-readiness` | claim-readiness-registry | `control-plane:read` | Future |
| R14 | Get payer readiness detail | `markets.payer-readiness` | `getPayerReadiness` | `GET /payer-readiness/{payerId}` | claim-readiness-registry | `control-plane:read` | Future |
| R15 | List environments | `fleet.environments` | `listEnvironments` | `GET /fleet/environments` | fleet-environment-registry | `control-plane:read` | Future |
| R16 | List feature flags (fleet) | `fleet.environments` | `listFeatureFlags` | `GET /fleet/feature-flags` | fleet-environment-registry | `control-plane:read` | Future |
| R17 | List release channels | `fleet.environments` | `listReleaseChannels` | `GET /fleet/release-channels` | fleet-environment-registry | `control-plane:read` | Future |
| R18 | List backups | `fleet.backup-dr` | `listBackups` | `GET /fleet/backups` | fleet-backup-registry | `control-plane:read` | Future |
| R19 | List DR test results | `fleet.backup-dr` | `listDrTests` | `GET /fleet/dr-tests` | fleet-backup-registry | `control-plane:read` | Future |
| R20 | List billing summary | `commerce.billing` | `listBilling` | `GET /commerce/billing` | commercial-subscription-registry | `control-plane:read` | Future |
| R21 | Get subscription detail | `commerce.billing` | `getSubscription` | `GET /commerce/subscriptions/{tenantId}` | commercial-subscription-registry | `control-plane:read` | Future |
| R22 | List usage summary | `commerce.usage` | `listUsage` | `GET /commerce/usage` | commercial-metering-store | `control-plane:read` | Future |
| R23 | Get tenant usage detail | `commerce.usage` | `getUsageDetail` | `GET /commerce/usage/{tenantId}` | commercial-metering-store | `control-plane:read` | Future |
| R24 | Get platform health | `operations-center` | `getPlatformHealth` | `GET /platform/health` | Cross-cutting (all 7 domains) | `control-plane:read` | Future |
| R25 | List active alerts | `operations-center`, `alerts` | `listAlerts` | `GET /alerts` | support-incident-store | `control-plane:read` | Future |
| R26 | List platform events | `operations-center` | `listPlatformEvents` | `GET /platform/events` | audit-event-store | `control-plane:read` | Future |
| R27 | List templates | `platform.templates` | `listTemplates` | `GET /templates` | governance-template-registry | `control-plane:read` | Future |
| R28 | Get template detail | `platform.templates` | `getTemplate` | `GET /templates/{id}` | governance-template-registry | `control-plane:read` | Future |
| R29 | List support cases | `platform.support` | `listCases` | `GET /support/cases` | support-incident-store | `control-plane:read` | Future |
| R30 | Get case detail | `platform.support` | `getCaseDetail` | `GET /support/cases/{id}` | support-incident-store | `control-plane:read` | Future |
| R31 | List audit events | `platform.audit` | `listAuditEvents` | `GET /audit/events` | audit-event-store | `control-plane:read` | Future |
| R32 | Verify audit chain | `platform.audit` | `verifyAuditChain` | `GET /audit/verify` | audit-event-store | `control-plane:read` | Future |
| R33 | List runbooks | `platform.runbooks` | `listRunbooks` | `GET /runbooks` | governance-runbook-registry | `control-plane:read` | Future |
| R34 | Get runbook content | `platform.runbooks` | `getRunbook` | `GET /runbooks/{id}` | governance-runbook-registry | `control-plane:read` | Future |
| R35 | Export usage report | `commerce.usage` | `exportUsage` | `GET /commerce/usage/export` | commercial-metering-store | `control-plane:read` | Future |
| R36 | Export audit report | `platform.audit` | `exportAudit` | `GET /audit/export` | audit-event-store | `control-plane:audit:export` | Future |

### 3.3 Write actions — Batch 1 surfaces

Carried forward from batch-1 §3.2 with no changes.

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Precondition | Outcome | Status |
|---|--------|---------|---------------|------|-----------------|------------|-------------|---------|--------|
| W1 | Resolve effective plan | `tenants.bootstrap` | `resolveEffectiveConfigurationPlan` | `POST /effective-configuration-plans:resolve` | platform-governance | `control-plane:tenant:bootstrap` | Market selected | Returns PlanResolutionResult | Exists |
| W2 | Submit bootstrap request | `tenants.bootstrap` | `createTenantBootstrapRequest` | `POST /tenant-bootstrap-requests` | platform-governance | `control-plane:tenant:bootstrap` | Plan resolved; effectivePlanId valid | 202 Accepted; emits `tenant.bootstrap.requested` | Exists |
| W3 | Initiate provisioning run | `provisioning.runs` | `createProvisioningRun` | `POST /provisioning-runs` | platform-governance | `control-plane:provisioning:manage` | Bootstrap request approved; no run in progress | 202 Accepted; emits `provisioning.run.requested` | Exists |
| W4 | Retry provisioning run | `provisioning.runs` | `createProvisioningRun` | `POST /provisioning-runs` | platform-governance | `control-plane:provisioning:manage` | Previous run is `failed` | New provisioningRunId; same as W3 | Exists (reuse) |
| W5 | Cancel provisioning run | `provisioning.runs` | `cancelProvisioningRun` | `POST /provisioning-runs/{id}/cancel` | platform-governance | `control-plane:provisioning:manage` | Run is `queued` or `in-progress` | Run → `cancelled` | Contracted |
| W6 | Suspend tenant | `tenants.detail` | `suspendTenant` | `POST /tenants/{id}/suspend` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `active` | status → `suspended` | Contracted |
| W7 | Reactivate tenant | `tenants.detail` | `reactivateTenant` | `POST /tenants/{id}/reactivate` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `suspended` | status → `active` | Contracted |
| W8 | Archive tenant | `tenants.detail` | `archiveTenant` | `POST /tenants/{id}/archive` | platform-tenant-registry | `control-plane:tenant:lifecycle` | Tenant is `suspended`; operator confirms | status → `archived`; irreversible | Contracted |
| W9 | Toggle feature flag | `system.config` | `updateFeatureFlag` | `PUT /system-config/feature-flags/{flagKey}` | platform-system-configuration | `control-plane:config:write` | Flag exists | Flag toggled | Contracted |
| W10 | Update system parameter | `system.config` | `updateSystemParameter` | `PUT /system-config/parameters/{paramKey}` | platform-system-configuration | `control-plane:config:write` | Parameter is editable | Parameter updated | Contracted |
| W11 | Create market profile draft | `markets.management` | `createLegalMarketProfileDraft` | `POST /legal-market-profiles` | claim-readiness-registry | `control-plane:markets:write` | Operator has write permission | Draft created | Contracted |
| W12 | Update market profile draft | `markets.management` | `updateLegalMarketProfileDraft` | `PUT /legal-market-profiles/{legalMarketId}` | claim-readiness-registry | `control-plane:markets:write` | Profile is `draft` | Draft updated | Contracted |
| W13 | Submit market profile | `markets.management` | `submitLegalMarketProfileForReview` | `POST /legal-market-profiles/{legalMarketId}:submit-review` | claim-readiness-registry | `control-plane:markets:write` | Profile is `draft` | status → `review-pending` | Contracted |
| W14 | Create pack manifest draft | `packs.catalog` | `createPackManifestDraft` | `POST /packs` | platform-pack-catalog | `control-plane:packs:write` | Operator has write permission | Draft created | Contracted |
| W15 | Update pack manifest draft | `packs.catalog` | `updatePackManifestDraft` | `PUT /packs/{packId}` | platform-pack-catalog | `control-plane:packs:write` | Pack is `draft` | Draft updated | Contracted |
| W16 | Submit pack manifest | `packs.catalog` | `submitPackManifestForReview` | `POST /packs/{packId}:submit-review` | platform-pack-catalog | `control-plane:packs:write` | Pack is `draft` | lifecycleState → `review-pending` | Contracted |

### 3.4 Write actions — New v2 surfaces

| # | Action | Surface | API Operation | HTTP | Source of Truth | Permission | Precondition | Outcome | Status |
|---|--------|---------|---------------|------|-----------------|------------|-------------|---------|--------|
| W17 | Send invitation | `tenants.identity` | `sendInvitation` | `POST /invitations` | platform-identity-registry | `control-plane:identity:manage` | Valid email; tenant selected; role assigned | Invitation created; emits `invitation.sent` | Future |
| W18 | Resend invitation | `tenants.identity` | `resendInvitation` | `POST /invitations/{id}/resend` | platform-identity-registry | `control-plane:identity:manage` | Invitation pending or expired | Invitation resent; emits `invitation.resent` | Future |
| W19 | Revoke invitation | `tenants.identity` | `revokeInvitation` | `POST /invitations/{id}/revoke` | platform-identity-registry | `control-plane:identity:manage` | Invitation pending or accepted | Invitation revoked; emits `invitation.revoked` | Future |
| W20 | Revoke member access | `tenants.identity` | `revokeMember` | `POST /identities/{id}/revoke` | platform-identity-registry | `control-plane:identity:manage` | Identity is active | Member revoked; emits `member.revoked` | Future |
| W21 | Flag payer issue | `markets.payer-readiness` | `flagPayerIssue` | `POST /payer-readiness/{id}/flag-issue` | claim-readiness-registry | `control-plane:markets:write` | Payer selected | Issue flagged; emits `payer.readiness.issue-flagged` | Future |
| W22 | Toggle feature flag (fleet) | `fleet.environments` | `toggleFeatureFlag` | `PUT /fleet/feature-flags/{key}` | fleet-environment-registry | `control-plane:fleet:manage` | Flag exists; environment specified | Flag toggled; emits `flag.toggled` | Future |
| W23 | Assign release channel | `fleet.environments` | `assignReleaseChannel` | `PUT /fleet/release-channels/{id}/tenants` | fleet-environment-registry | `control-plane:fleet:manage` | Tenant exists; channel valid | Channel assigned; emits `release-channel.assigned` | Future |
| W24 | Trigger backup | `fleet.backup-dr` | `triggerBackup` | `POST /fleet/backups` | fleet-backup-registry | `control-plane:fleet:manage` | Environment selected | Backup started; emits `backup.triggered` | Future |
| W25 | Initiate restore | `fleet.backup-dr` | `initiateRestore` | `POST /fleet/restores` | fleet-backup-registry | **`control-plane:fleet:restore`** | Backup selected; reason provided; confirmation dialog accepted | Restore started; emits `restore.initiated` | Future |
| W26 | Record DR test | `fleet.backup-dr` | `recordDrTest` | `POST /fleet/dr-tests` | fleet-backup-registry | `control-plane:fleet:manage` | Test results available | DR test recorded; emits `dr-test.recorded` | Future |
| W27 | Record payment | `commerce.billing` | `recordPayment` | `POST /commerce/payments` | commercial-subscription-registry | `control-plane:commerce:manage` | Tenant selected; amount entered | Payment recorded; emits `payment.recorded` | Future |
| W28 | Suspend subscription | `commerce.billing` | `suspendSubscription` | `POST /commerce/subscriptions/{tenantId}/suspend` | commercial-subscription-registry | `control-plane:commerce:manage` | Tenant is past-due; confirmation required | Subscription suspended; triggers tenant suspension; emits `subscription.suspended` | Future |
| W29 | Reactivate subscription | `commerce.billing` | `reactivateSubscription` | `POST /commerce/subscriptions/{tenantId}/reactivate` | commercial-subscription-registry | `control-plane:commerce:manage` | Subscription is suspended; payment recorded | Subscription reactivated; emits `subscription.reactivated` | Future |
| W30 | Acknowledge attention item | `operations-center` | `acknowledgeAttentionItem` | `POST /platform/attention/{id}/acknowledge` | n/a (cross-cutting) | `control-plane:read` | Item selected | Item dismissed from queue; emits `attention.acknowledged` | Future |
| W31 | Create template | `platform.templates` | `createTemplate` | `POST /templates` | governance-template-registry | `control-plane:templates:manage` | — | Template created as draft; emits `template.created` | Future |
| W32 | Update template | `platform.templates` | `updateTemplate` | `PUT /templates/{id}` | governance-template-registry | `control-plane:templates:manage` | Template is draft | Template updated; emits `template.updated` | Future |
| W33 | Publish template | `platform.templates` | `publishTemplate` | `POST /templates/{id}/publish` | governance-template-registry | `control-plane:templates:manage` | Template is draft; validation passes | status → published; emits `template.published` | Future |
| W34 | Deprecate template | `platform.templates` | `deprecateTemplate` | `POST /templates/{id}/deprecate` | governance-template-registry | `control-plane:templates:manage` | Template is published | status → deprecated; emits `template.deprecated` | Future |
| W35 | Create support case | `platform.support` | `createCase` | `POST /support/cases` | support-incident-store | `control-plane:support:manage` | Summary and category required | Case created; emits `case.created` | Future |
| W36 | Update case status | `platform.support` | `updateCase` | `PUT /support/cases/{id}` | support-incident-store | `control-plane:support:manage` | Case is open or in-progress | Case updated; emits `case.updated` | Future |
| W37 | Assign case | `platform.support` | `assignCase` | `POST /support/cases/{id}/assign` | support-incident-store | `control-plane:support:manage` | Case is open or in-progress | Case assigned; emits `case.assigned` | Future |
| W38 | Escalate to incident | `platform.support` | `createIncident` | `POST /support/incidents` | support-incident-store | `control-plane:support:manage` | Case is critical or high | Incident created; emits `incident.created` | Future |
| W39 | Resolve case | `platform.support` | `resolveCase` | `POST /support/cases/{id}/resolve` | support-incident-store | `control-plane:support:manage` | Case is open/in-progress; resolution notes required | Case resolved; emits `case.resolved` | Future |
| W40 | Acknowledge alert | `platform.alerts` | `acknowledgeAlert` | `POST /alerts/{id}/acknowledge` | support-incident-store | `control-plane:alerts:manage` | Alert is active | Alert acknowledged; emits `alert.acknowledged` | Future |
| W41 | Silence alert | `platform.alerts` | `silenceAlert` | `POST /alerts/{id}/silence` | support-incident-store | `control-plane:alerts:manage` | Alert active; justification required; duration set | Alert silenced; emits `alert.silenced` | Future |

### 3.5 Navigation actions — Batch 1 surfaces

Carried forward from batch-1 §3.3 with no changes.

| # | Action | From surface | To surface | Context passed | Mechanism |
|---|--------|-------------|-----------|----------------|-----------|
| N1 | Drill to tenant | `tenants.list` | `tenants.detail` | `tenantId` | Same-workspace nav |
| N2 | Create new tenant | `tenants.list` | `tenants.bootstrap` | — | Same-workspace nav |
| N3 | Launch bootstrap | `tenants.detail` | `tenants.bootstrap` | `tenantId` | Same-workspace nav |
| N4 | View provisioning run | `tenants.detail` | `provisioning.runs` | `provisioningRunId` | Same-workspace nav |
| N5 | Open tenant admin | `tenants.detail` | tenant-admin workspace | `tenantId` | Cross-workspace transition |
| N6 | Navigate to provisioning | `tenants.bootstrap` | `provisioning.runs` | `bootstrapRequestId` | Same-workspace nav |
| N7 | Drill to market | `markets.management` | `markets.detail` | `legalMarketId` | Same-workspace nav |
| N8 | Bootstrap for market | `markets.detail` | `tenants.bootstrap` | `legalMarketId` | Same-workspace nav |
| N9 | Back to market list | `markets.detail` | `markets.management` | — | Breadcrumb nav |

### 3.6 Navigation actions — New v2 surfaces

| # | Action | From surface | To surface | Context passed | Mechanism |
|---|--------|-------------|-----------|----------------|-----------|
| N10 | Drill to tenant identity | `tenants.identity` | `tenants.detail` | `tenantId` | Row click |
| N11 | Drill to payer readiness | `markets.detail` | `markets.payer-readiness` | `legalMarketId` | Action link |
| N12 | Payer to market detail | `markets.payer-readiness` | `markets.detail` | `legalMarketId` | Market column click |
| N13 | Simulate eligibility | `packs.catalog` | `packs.eligibility-simulator` | `packSelections` | Action button |
| N14 | Simulation to templates | `packs.eligibility-simulator` | `platform.templates` | simulation config | Action link |
| N15 | Operations drill | `operations-center` | any service domain | varies | Card/item click |
| N16 | Billing to tenant | `commerce.billing` | `tenants.detail` | `tenantId` | Tenant column click |
| N17 | Tenant to billing | `tenants.detail` | `commerce.billing` detail | `tenantId` | Action link |
| N18 | Alert to support | `platform.alerts` | `platform.support` | alert context | Escalate action |
| N19 | Template to bootstrap | `platform.templates` | `tenants.bootstrap` | template context | Apply action |

---

## 4. Event bindings

### 4.1 Events produced by write actions — Batch 1

Carried forward from batch-1 §4.1 with no changes.

| Write action | Event emitted | AsyncAPI channel | Key payload fields |
|-------------|---------------|-------------------|-------------------|
| W1 (resolve plan) | `effective-plan.resolved` | `effectivePlanResolved` | effectivePlanId, legalMarketId, resolvedPackCount, deferredItemCount, effectiveLaunchTier |
| W2 (submit bootstrap) | `tenant.bootstrap.requested` | `tenantBootstrapRequested` | bootstrapRequestId, tenantId, effectivePlanId, legalMarketId, requestedBy |
| W3 (initiate run) | `provisioning.run.requested` | `provisioningRunRequested` | provisioningRunId, bootstrapRequestId, tenantId, effectivePlanId, legalMarketId |
| W9 (toggle flag) | `system.config.feature-flag.updated` | `systemConfigFeatureFlagUpdated` | flagKey, enabled, previousEnabled, updatedBy |
| W10 (update param) | `system.config.parameter.updated` | `systemConfigParameterUpdated` | paramKey, value, previousValue, updatedBy |
| W11–W16 | market/pack lifecycle events | See batch-1 §4.1 | legalMarketId or packId, requestedBy, etc. |

### 4.2 Events produced by write actions — New v2

| Write action | Event emitted | Key payload fields |
|-------------|---------------|-------------------|
| W17 (send invitation) | `invitation.sent` | invitationId, email, tenantId, roleCategory, sentBy |
| W18 (resend invitation) | `invitation.resent` | invitationId, email, resentBy |
| W19 (revoke invitation) | `invitation.revoked` | invitationId, revokedBy, reason |
| W20 (revoke member) | `member.revoked` | identityId, tenantId, revokedBy, reason |
| W21 (flag payer issue) | `payer.readiness.issue-flagged` | payerId, legalMarketId, issueDescription, flaggedBy |
| W22 (toggle flag/fleet) | `flag.toggled` | flagKey, environmentId, enabled, previousEnabled, updatedBy |
| W23 (assign channel) | `release-channel.assigned` | tenantId, channelId, previousChannelId, assignedBy |
| W24 (trigger backup) | `backup.triggered` | backupId, environmentId, triggeredBy |
| W25 (initiate restore) | `restore.initiated` | restoreId, backupId, environmentId, reason, initiatedBy |
| W26 (record DR test) | `dr-test.recorded` | testId, environmentId, result, rtoMinutes, rpoMinutes |
| W27 (record payment) | `payment.recorded` | tenantId, amount, currency, recordedBy |
| W28 (suspend subscription) | `subscription.suspended` | tenantId, reason, suspendedBy |
| W29 (reactivate subscription) | `subscription.reactivated` | tenantId, reactivatedBy |
| W30 (acknowledge attention) | `attention.acknowledged` | itemId, acknowledgedBy |
| W31 (create template) | `template.created` | templateId, templateType, createdBy |
| W32 (update template) | `template.updated` | templateId, updatedFields, updatedBy |
| W33 (publish template) | `template.published` | templateId, publishedBy |
| W34 (deprecate template) | `template.deprecated` | templateId, deprecatedBy |
| W35 (create case) | `case.created` | caseId, tenantId, priority, category, createdBy |
| W36 (update case) | `case.updated` | caseId, updatedFields, updatedBy |
| W37 (assign case) | `case.assigned` | caseId, assignedTo, assignedBy |
| W38 (escalate to incident) | `incident.created` | incidentId, sourceCaseId, createdBy |
| W39 (resolve case) | `case.resolved` | caseId, resolutionNotes, resolvedBy |
| W40 (acknowledge alert) | `alert.acknowledged` | alertId, acknowledgedBy |
| W41 (silence alert) | `alert.silenced` | alertId, justification, duration, silencedBy |

### 4.3 Events consumed by surfaces

| Surface | Consumed events | UI behavior |
|---------|----------------|-------------|
| `tenants.bootstrap` | `tenant.bootstrap.requested`, `effective-plan.resolved` | Updates submission status |
| `provisioning.runs` | All 5 provisioning events | Real-time status, step progress |
| `operations-center` | Platform-wide events | Attention queue + event timeline |
| `fleet.backup-dr` | `backup.completed`, `restore.completed` | Status refresh |
| `platform.alerts` | `alert.fired` | New alert appears in active list |
| `platform.support` | `case.created`, `incident.created` | Case queue refresh |

### 4.4 AsyncAPI channel status

- **Original 7 channels:** Defined in existing AsyncAPI contract
- **Batch 3 channels (W9–W16):** Contracted, pending AsyncAPI spec authoring
- **v2 channels (W17–W41):** Future — require new AsyncAPI channel definitions

---

## 5. Source-of-truth binding matrix

### 5.1 Batch 1 sources of truth

Carried forward from batch-1 §5 with no changes.

| Source of Truth | Domain class | Read surfaces | Write surfaces | Data classification |
|----------------|-------------|--------------|---------------|-------------------|
| `platform-tenant-registry` | platform-governance | `tenants.list`, `tenants.detail` | `tenants.detail` (lifecycle) | configuration |
| `platform-governance` | platform-governance | `tenants.bootstrap`, `provisioning.runs`, `tenants.detail` | `tenants.bootstrap`, `provisioning.runs` | configuration / operational |
| `claim-readiness-registry` | claim-readiness-registry | `markets.management`, `markets.detail` | `markets.management` (W11–W13) | configuration |
| `platform-pack-catalog` | platform-governance | `packs.catalog` | `packs.catalog` (W14–W16) | configuration |
| `platform-system-configuration` | platform-governance | `system.config` | `system.config` (W9–W10) | configuration |

### 5.2 New v2 sources of truth

| Source of Truth | Service domain | Read surfaces | Write surfaces | Data classification |
|----------------|---------------|--------------|---------------|-------------------|
| `platform-identity-registry` | Tenant Portfolio | `tenants.identity` | `tenants.identity` (W17–W20) | configuration |
| `claim-readiness-registry` (payer) | Composition & Eligibility | `markets.payer-readiness` | `markets.payer-readiness` (W21) | configuration |
| `fleet-environment-registry` | Runtime Fleet & Release | `fleet.environments` | `fleet.environments` (W22–W23) | operational |
| `fleet-backup-registry` | Runtime Fleet & Release | `fleet.backup-dr` | `fleet.backup-dr` (W24–W26) | operational |
| `commercial-subscription-registry` | Commercial | `commerce.billing` | `commerce.billing` (W27–W29) | financial |
| `commercial-metering-store` | Commercial | `commerce.usage` | — (read-only) | operational |
| `governance-template-registry` | Governance & Readiness | `platform.templates` | `platform.templates` (W31–W34) | configuration |
| `support-incident-store` | Support / Incident / Audit | `platform.support`, `platform.alerts` | `platform.support` (W35–W39), `platform.alerts` (W40–W41) | operational |
| `audit-event-store` | Support / Incident / Audit | `platform.audit`, `operations-center` | — (append-only by system; read-only to operator) | audit |
| `governance-runbook-registry` | Governance & Readiness | `platform.runbooks` | — (read-only) | reference |

---

## 6. Claim surface binding

Carried forward from batch-1 §6, extended with v2 surfaces.

| Surface | claimSurfaceType | claimDomains | informationalOnly | gatingRuleRef | minimumReadinessState |
|---------|-----------------|-------------|-------------------|---------------|----------------------|
| `tenants.bootstrap` | control-plane-provisioning | capability, market, pack-eligibility | false | capability-truth-§11 | declared |
| `provisioning.runs` | control-plane-provisioning | provisioning-lifecycle | false | capability-truth-§11 | declared |
| `markets.management` | control-plane-provisioning | market, capability | false | capability-truth-§11 | — |
| `markets.detail` | control-plane-provisioning | market, readiness | **true** | capability-truth-§11 | declared |
| `packs.catalog` | control-plane-provisioning | pack-eligibility, capability | false | capability-truth-§11 | — |
| `markets.payer-readiness` | control-plane-provisioning | payer, readiness | **true** | capability-truth-§11 | declared |
| `packs.eligibility-simulator` | control-plane-provisioning | pack-eligibility | **true** | capability-truth-§11 | — |
| `tenants.list` | — | — | — | — | — |
| `tenants.detail` | — | — | — | — | — |
| `tenants.identity` | — | — | — | — | — |
| `system.config` | — | — | — | — | — |
| `fleet.environments` | — | — | — | — | — |
| `fleet.backup-dr` | — | — | — | — | — |
| `commerce.billing` | — | — | — | — | — |
| `commerce.usage` | — | — | — | — | — |
| `operations-center` | — | — | — | — | — |
| `platform.templates` | — | — | — | — | — |
| `platform.support` | — | — | — | — | — |
| `platform.audit` | — | — | — | — | — |
| `platform.alerts` | — | — | — | — | — |
| `platform.runbooks` | — | — | — | — | — |

**Notes:**
- `payer-readiness` and `eligibility-simulator` are `informationalOnly: true` — they display claim/readiness state but do not gate operator actions
- Fleet, Commerce, Platform nav group surfaces are not governed by claim-readiness constraints — they manage infrastructure, not provisioning
- Claim surface binding remains restricted to the Markets nav group and the Tenants nav group bootstrap/provisioning flow

---

## 7. Audit trail requirements

Every write action (W1–W41) must produce an audit entry:

| Field | Source |
|-------|--------|
| `eventType` | Action identifier (e.g., `invitation.sent`, `backup.triggered`) |
| `occurredAt` | ISO 8601 timestamp |
| `correlationId` | End-to-end workflow correlation ID |
| `requestedBy` | Operator identity from auth context |
| `tenantId` | Target tenant (where applicable; null for platform-wide actions) |
| `detail` | Action-specific payload (no PHI in control-plane events) |

### 7.1 High-risk action audit enrichment

The following actions produce enriched audit entries with additional fields:

| Action | Additional audit fields | Reason |
|--------|------------------------|--------|
| W8 (archive tenant) | `previousState`, `confirmationToken` | Irreversible action |
| W25 (initiate restore) | `reason`, `confirmationToken`, `targetEnvironment`, `backupId` | Highest-risk action; destructive |
| W28 (suspend subscription) | `reason`, `billingStatus`, `balanceDue` | Financial consequence + tenant impact |
| W20 (revoke member) | `previousRole`, `reason` | Access removal |

Audit entries are immutable and append-only. The control-plane audit trail is separate from clinical audit (no PHI ever flows through control-plane events). The audit chain is verifiable via `GET /audit/verify` (R32).

---

## 8. Integration status summary

| Category | Count | Details |
|----------|-------|---------|
| **Read actions — existing API** | 10 | R1–R10 |
| **Read actions — future API** | 26 | R11–R36 |
| **Write actions — existing API** | 4 | W1–W4 |
| **Write actions — contracted (Batch 2)** | 4 | W5–W8 |
| **Write actions — contracted (Batch 3)** | 8 | W9–W16 |
| **Write actions — future (v2)** | 25 | W17–W41 |
| **Navigation actions — Batch 1** | 9 | N1–N9 |
| **Navigation actions — v2** | 10 | N10–N19 |
| **Events produced** | ~36 | 11 existing/contracted + ~25 future |
| **Events consumed** | ~12 | 7 original + ~5 future surface subscriptions |
| **Sources of truth** | 15 | 5 existing + 10 new |
| **Permission claims** | 15 | 7 existing + 8 new |

---

## 9. Verification checklist

- [ ] Every action in page-specs v2 appears in this matrix (R, W, or N row)
- [ ] Every API operation reference matches an existing contract or is marked Future
- [ ] Every Batch 1 event reference matches the AsyncAPI contract
- [ ] Every source-of-truth reference matches screen-inventory `sourceOfTruth` entries
- [ ] Permission claims are consistent with permissions-matrix §7A
- [ ] Claim surface bindings match screen-inventory `claimSurface` fields
- [ ] All 21 surfaces appear in the claim surface binding table (§6)
- [ ] Deferred/future items are explicitly marked and not presented as available
- [ ] Audit requirements cover all 41 write actions
- [ ] High-risk actions (W8, W25, W28, W20) have enriched audit entries
- [ ] No new data models invented — all fields trace to existing or planned schemas
- [ ] Navigation actions are consistent with page-specs v2 §8 cross-surface navigation
