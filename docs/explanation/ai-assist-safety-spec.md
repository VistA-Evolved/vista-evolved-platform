# AI Assist Safety Specification

> Artifact #8 in the global system architecture sequence (global-system-architecture-spec.md §20).
> Defines the canonical safety and governance model for AI assist features in VistA Evolved.

!!! warning "Architecture governance only"
    This document defines safety boundaries, review models, storage rules, and governance posture.
    It does NOT define service code, API endpoints, model integrations, prompt templates, or UI implementation.
    Implementation artifacts are downstream of this spec and require separate authorization.

---

## 1. Document purpose and status

### 1.1 What this document is

This is the authoritative AI assist safety specification for VistA Evolved. It establishes:

- The taxonomy of allowed AI assist classes.
- The input and output governance boundaries for each class.
- The human review and approval model.
- The write-back restrictions that protect VistA operational truth.
- The storage, retention, and PHI handling posture.
- The provider and model governance posture.
- The failure behavior and fallback rules.
- The audit and traceability requirements.
- The claim and marketing boundaries for AI features.
- The workspace and screen-contract implications.

### 1.2 What this document is not

This document does NOT:

- Define concrete model registry schemas or provider integration code.
- Define API endpoints, service contracts, or OpenAPI specs for AI services.
- Define prompt templates, embeddings strategies, or model fine-tuning approaches.
- Define UI panels, components, or layout for AI assist surfaces.
- Define an automated policy engine implementation.
- Define detailed data-retention schedules (those require legal/compliance input).
- Authorize autonomous clinical decision-making.

### 1.3 Position in the architecture sequence

This is artifact #8 in the governed artifact pipeline (global-system-architecture-spec.md §20):

| # | Artifact | Status |
|---|----------|--------|
| 1 | Organization-facility-network-service model | Accepted |
| 2 | Pack and adapter architecture governance | Accepted |
| 3 | Capability truth and claim-gating spec | Accepted |
| 4 | Country and payer readiness registry spec | Accepted |
| 5 | Specialty, content, and analytics architecture | Accepted |
| 6 | Information architecture and workspace map | Accepted |
| 7 | Screen contract schema | Accepted |
| **8** | **AI assist safety spec (this document)** | **Current** |

This spec operationalizes the AI assist plane position established in global-system-architecture-spec.md §7.8 and §16. It consumes the screen contract schema, claim-gating rules, workspace model, truth-boundary rules, and PHI safety model from the seven preceding artifacts as inputs.

---

## 2. Relationship to parent specifications

### 2.1 Global system architecture

- **§7.8 (AI assist plane):** Establishes that AI features operate under strict governance: declared I/O, review gates, storage boundaries, failure modes, audit trails, no autonomous clinical writes.
- **§16 (AI safety boundary):** Defines the 6 non-negotiable rules (declared I/O, review gate, storage boundary, failure mode, audit trail, no PHI in training) and 4 example feature classes. This spec elaborates these into a full taxonomy and governance model.
- **§17 (AI coding governance):** Governs how AI coding agents operate during development. This spec governs how AI-assisted clinical and operational features behave at runtime. Both are needed; they govern different phases.
- **§4 (Anti-goals):** "AI drift without review gates" is an explicit anti-goal. This spec operationalizes that constraint.
- **§19 (Out of scope):** "Automated AI clinical decision-making" is explicitly not authorized. This spec enforces that boundary.

### 2.2 Capability truth and claim-gating

AI features are capabilities. They follow the same 9-state readiness model (capability-truth §7.1), evidence requirements (§8), and claim-gating rules (§11). No AI feature may be publicly claimed as "available" unless it has reached at least the "verified" readiness state with scoped evidence.

### 2.3 Specialty, content, and analytics architecture

- **§11 (Analytics boundary):** AI-generated summaries, metrics, or insights that appear on analytics surfaces must follow analytics boundary rules: derived data only, read-only, no hidden write paths, PHI safety at the boundary.
- **§12 (PHI safety):** The 4 PHI safety rules (no casual duplication, de-identification by default, minimum-necessary exposure, no PHI in metric labels) apply to all AI assist features that handle patient data.
- **§19:** "AI-assisted content authoring" was explicitly deferred. This spec defines the governance posture for content assist without authorizing a specific implementation.

### 2.4 Information architecture and workspace map

- **§15 (Analytics workspace):** AI-generated content appearing in analytics workspace must follow analytics boundary rules.
- **§17 (Claim surfaces):** AI feature claims on any claim surface must follow claim-gating rules.
- **§19 (Screen contracts):** AI assist surfaces must have screen contracts with the required fields: workspace family, data classification, access requirements, refresh behavior, etc.
- **§20 (Safety invariants):** No workspace collapse, no inline rendering across boundaries, no shared mutable state — all apply to AI assist surfaces.

### 2.5 Screen contract schema

AI assist surfaces are surfaces. They must have screen contracts conforming to `packages/contracts/schemas/screen-contract.schema.json`. Relevant schema constraints:

- `dataClassification`: AI surfaces that process PHI must declare `"phi"` and provide a `phiGovernance` declaration.
- `readWritePosture`: Most AI assist surfaces should be `"read-only"` or `"controlled-write"`. `"mixed"` requires explicit justification.
- `claimSurface`: If an AI assist surface is also a claim surface (e.g., marketing an "AI-powered" capability), the claim-surface declaration is mandatory with a `gatingRuleRef`.
- `analyticsSurface`: AI-generated analytics must declare analytics surface attributes including `derivedDataOnly`, `writeProhibited`, and `phiDisclosure`.

### 2.6 AI coding governance and SDLC

`docs/explanation/ai-coding-governance-and-sdlc.md` governs how AI coding agents operate during development. This spec governs how AI-assisted features behave at runtime for end users. The overlap is: both require governed outputs, audit trails, and human review. They differ in scope: coding governance is developer-facing; this spec is clinician/operator/patient-facing.

### 2.7 What the distro repo is canonical for

Per `vista-evolved-vista-distro/docs/reference/runtime-truth.md`:

- VistA is the source of truth for clinical and operational data.
- The distro repo is canonical for VistA runtime behavior, lane designation, charset handling, and routine integrity.
- This spec must NOT reassign clinical data ownership away from VistA.
- AI assist features consume VistA data through governed APIs; they do not replace VistA truth.

---

## 3. Goals

1. **Assistive, not autonomous.** AI features assist clinicians, operators, and users. They do not make autonomous decisions that affect patient care, orders, or the clinical record.
2. **Human review before record entry.** No AI-generated output enters the clinical record, triggers an order, or modifies operational data without explicit human review and approval.
3. **Declared inputs and outputs.** Every AI assist class must declare what inputs it consumes, what outputs it produces, and what side effects (if any) it may cause.
4. **Clear auditability.** Every AI-assisted action — generation, review, approval, rejection, insertion — must be auditable with provenance.
5. **Safe PHI handling.** AI features that process patient data must follow minimum-necessary principles, governed access, and audit. No casual PHI duplication into AI processing pipelines.
6. **Graceful degradation.** If AI services are unavailable, clinical and operational workflows must continue without AI assist. AI is never load-bearing for basic patient care.
7. **Governed provider posture.** Model and provider choices are governance decisions, not developer convenience. PHI sensitivity, latency, auditability, and retention all influence provider posture.
8. **Truthful claims.** Public statements about AI features must follow claim-gating rules. "AI-powered" must mean something specific and verified, not a marketing assertion.
9. **Future expansion without drift.** The safety model must accommodate new assist classes, providers, and features without weakening review boundaries or audit requirements.
10. **One truth.** AI output is never truth. VistA remains the clinical and operational source of truth. AI output is assistive, draft, or advisory until a human makes it part of the governed record.

---

## 4. Anti-goals and forbidden drift

These patterns are explicitly rejected. They are not "edge cases to handle later" — they are architectural violations.

| Forbidden pattern | Why it is forbidden |
|-------------------|-------------------|
| **Autonomous diagnosis** | AI must not issue or confirm diagnoses without clinician review. Diagnosis is a clinician responsibility. |
| **Autonomous orders or prescriptions** | AI must not place orders, prescribe medications, or initiate treatments. AI may suggest or rank; a clinician must approve and sign. |
| **Hidden write-back into VistA** | No AI process may directly modify VistA globals, files, or records outside governed write paths with human approval. |
| **Hidden model or provider switching** | Changing the AI model, provider, or configuration in production must be a governed action with audit trail, not a silent deployment. |
| **Vague "AI enabled" claims** | Claiming a feature is "AI-powered" without specifying the assist class, review path, scope, and readiness state is forbidden by claim-gating rules. |
| **Storing more than necessary** | AI processing pipelines must not retain prompts, responses, embeddings, or intermediate results beyond the minimum necessary for the governed purpose. |
| **Using AI output as unreviewed record truth** | AI-generated text, codes, or suggestions must never be inserted into clinical records without explicit human review and approval. |
| **Letting convenience override review** | Pressure to "speed up workflows" must not erode review boundaries. Faster is not safer if review is skipped. |
| **PHI in model training** | Patient data must never be sent to model training pipelines without explicit, governed consent review (global-arch §16). |
| **AI-generated content presented as authoritative clinical guidance** | AI summaries, suggestions, and drafts must be visually and semantically distinguishable from authoritative clinical content. |

---

## 5. Canonical definitions

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|---------------|---------------|
| **AI assist feature** | A system capability that uses AI/ML models to generate, rank, summarize, translate, or suggest content in support of a human user's task. | Not an autonomous decision system. Not a replacement for clinician judgment. | Platform (governance), implementation varies |
| **Assist class** | A named category of AI assist features that share input types, output types, review expectations, and PHI posture. | Not a product feature name. Not a marketing label. | Platform |
| **Human review** | The act of a qualified human examining AI-generated output before it is acted upon, inserted into a record, or used to guide care. | Not a rubber-stamp. Not an automated validation check. Not optional for record-entry classes. | Shared (clinician for clinical, operator for operational) |
| **Approval boundary** | The point at which AI-generated output transitions from "draft/advisory" to "accepted/inserted" through explicit human action. | Not implicit. Not automatic. Not triggered by timeout or inaction. | Shared |
| **Write-back** | The act of inserting AI-influenced content into VistA globals, platform operational stores, or any governed record of truth. | Not a read operation. Not a display operation. Not advisory output shown to the user. | Platform (governance), VistA (truth) |
| **Draft output** | AI-generated content that has not yet been reviewed or approved. It may be displayed to the user but is clearly marked as draft and not stored in any record of truth. | Not a record. Not authoritative. Not final. | Platform |
| **Governed output** | AI-generated content that has passed through a defined review process and has been approved for a specific purpose (e.g., insertion into a note, use as a coding suggestion). | Not unreviewed. Not automatically promoted from draft. | Platform |
| **PHI exposure** | The degree to which an AI assist feature processes, transmits, or stores protected health information during its operation. | Not binary. Ranges from "none" to "direct patient-level PHI." | Platform (policy), VistA (data) |
| **Provider/model posture** | The governance classification of the AI model and provider infrastructure used by an assist class, including hosting location, data residency, PHI policy, and auditability. | Not just a vendor name. Not a pure performance decision. | Platform |
| **Retention policy** | The rules governing how long AI processing artifacts (prompts, responses, intermediate results) are retained and under what conditions they are purged. | Not "keep everything." Not unbounded. | Platform (policy), legal/compliance (input) |
| **Audit event** | A recorded entry tracking an AI assist action: what was generated, what was reviewed, what was approved, what was rejected, by whom, and when. | Not a log line. Not optional. Not an afterthought. | Platform |
| **Failure mode** | The defined behavior of an AI assist feature when the underlying AI service is unavailable, degraded, or returning errors. | Not silent failure. Not substitution of unchecked output. Not a user-facing error dump. | Platform |
| **Fallback behavior** | The specific alternative behavior activated when an AI service fails. Must be safe, truthful, and visible to the user. | Not hidden degradation. Not "try again silently." | Platform |
| **Clinician responsibility** | The principle that a clinician who reviews and approves AI-generated output for clinical use bears professional responsibility for that decision. AI does not transfer or absorb clinician responsibility. | Not a liability shift to the AI. Not an excuse for skipping review. | Shared (clinician, institution) |
| **Operator responsibility** | The principle that operators who configure, activate, or modify AI assist features bear operational responsibility for those governance decisions. | Not automated. Not delegated to the AI system itself. | Platform/operator |

---

## 6. AI assist taxonomy

### 6.1 Assist class table

| Assist class | What it may help with | What it must NOT do | Review expectation | PHI sensitivity |
|-------------|----------------------|--------------------|--------------------|----------------|
| **Intake assist** | Suggest next intake question from an approved question registry; rank question relevance; pre-populate draft fields from prior answers | Invent questions not in the approved registry; make triage decisions; auto-submit intake forms | Every suggestion is advisory. Auto-submission forbidden. Clinician reviews completed intake before acting on it. | Moderate — intake may include patient-reported symptoms and history |
| **Scribe/draft assist** | Generate draft clinical notes from encounter context; suggest note structure; summarize encounter elements for clinician review | Finalize or sign notes; insert text into the record without clinician review; generate diagnoses | Clinician MUST review, edit, and sign every draft. Draft text must be visually marked as AI-generated until signed. | High — processes encounter-level clinical data |
| **Coding/documentation assist** | Suggest ICD/CPT codes from note text; flag missing documentation for coding completeness; suggest code-level corrections | Auto-assign codes without coder review; modify billing records directly; replace coder judgment | Coder or clinician reviews and accepts/rejects each suggestion. No auto-assignment to claims. | Moderate-to-high — processes clinical documentation |
| **Translation assist** | Generate candidate translations for UI labels, patient-facing materials, clinical content; suggest terminology alternatives | Replace governed translation review process; auto-publish translations; handle medical terminology without clinical review | All translations require human review before activation. Medical/clinical translations require clinician-linguist review. | Low-to-moderate — depends on content being translated |
| **Summarization/search assist** | Summarize patient history, lab trends, medication lists; improve search relevance across clinical and operational data | Replace clinical chart review; present AI summaries as authoritative clinical data; hide source attribution | Summaries are advisory. Must link to source records. Must be marked as AI-generated. | High — processes patient-level clinical data |
| **Specialty workflow assist** | Support specialty-specific workflows (e.g., radiology read prioritization, pharmacy interaction checks) based on approved rule sets | Make autonomous specialty decisions; override clinical protocols; bypass specialty-specific review chains | Specialty clinician reviews and acts on suggestions. AI ranks and flags but does not decide. | High — specialty clinical data |
| **Operations/support assist** | Help operators with system configuration guidance, troubleshooting suggestions, log summarization, onboarding assistance | Make system configuration changes autonomously; bypass operator approval for infrastructure changes; access patient data for operational tasks | Operator reviews and acts on suggestions. Configuration changes require explicit operator action. | Low — operational/configuration data, no PHI |

### 6.2 Assist class governance rules

1. **Each deployed assist feature must map to exactly one assist class.** A feature may not span multiple classes without explicit justification and separate governance treatment for each class's concerns.
2. **New assist classes require architectural review.** Adding a class to this taxonomy requires a spec amendment, not just a code change.
3. **Assist class boundaries are not weakened by convenience pressure.** If a workflow would benefit from crossing an assist class boundary (e.g., scribe assist that also auto-codes), the feature must be decomposed into separately governed components.
4. **Assist classes inherit capability-truth readiness requirements.** An AI assist feature's readiness state is tracked using the same 9-state model as any other capability (capability-truth §7.1).

---

## 7. Allowed input classes

### 7.1 Input class table

| Input class | Description | Governance posture | Which assist classes may consume |
|------------|-------------|-------------------|-------------------------------|
| **De-identified knowledge context** | Medical references, drug databases, coding guidelines, publicly available clinical knowledge | Unrestricted within the assist framework | All assist classes |
| **Tenant/platform configuration context** | Tenant settings, module configuration, feature flags, pack metadata, approved question registries | Governed by platform — no PHI content | All assist classes |
| **Governed PHI workflow context** | Patient-specific clinical data (chart, notes, labs, meds, allergies) accessed through governed API paths for a specific clinical purpose | Requires: active patient context, authorized user session, minimum-necessary field selection, audit logging | Intake, scribe/draft, coding/documentation, summarization/search, specialty workflow |
| **Operational metadata** | System logs, performance metrics, configuration status, error rates | No PHI. Governed by platform operational access controls. | Operations/support assist |
| **Public/non-PHI reference content** | Language packs, UI labels, public-facing documentation, approved terminology | Unrestricted within the assist framework | Translation assist, operations/support assist |
| **User-provided free text** | Text entered by the user specifically for AI processing (e.g., a query, a description, a note draft) | Governed by the assist class's PHI sensitivity. If the user enters PHI, the assist class must handle it per PHI rules. | All assist classes (subject to class-specific rules) |

### 7.2 Input governance rules

1. **Not all assist classes may consume PHI.** Operations/support assist must not process patient data. Translation assist should operate on de-identified content unless explicitly governed for clinical translation with PHI controls.
2. **Minimum-necessary input selection.** An AI processing request must include only the fields necessary for the assist task. Sending the entire patient chart when only the medication list is relevant is a governance violation.
3. **Input provenance must be auditable.** The audit trail must record what data categories were included in each AI processing request (not the full content, but the classification and scope).
4. **No silent input expansion.** If an AI service requires additional context beyond what the assist class declares, that expansion must be governed and audited — not silently added by the implementation.

---

## 8. Allowed output classes

### 8.1 Output class table

| Output class | Description | May enter the record? | Requires human review? |
|-------------|-------------|----------------------|----------------------|
| **Draft text** | AI-generated text (note drafts, summaries, descriptions) presented to the user as draft content | Only after clinician review and explicit approval | Yes — mandatory |
| **Ranked suggestions** | Ordered list of options (codes, questions, order sets, search results) for human selection | Only the human-selected item enters the record through normal workflow | Yes — user selects from suggestions |
| **Candidate translations** | Proposed translations of labels, content, or documentation for human review | Only after human (translator/clinician-linguist) review and activation | Yes — mandatory |
| **Coding hints** | Suggested ICD/CPT codes with confidence indicators for coder review | Only after coder review and acceptance | Yes — mandatory |
| **Advisory summaries** | Concise summaries of patient data, trends, or operational status displayed as informational content | No — advisory only, not a record of truth | Not for record entry (no record created), but marked as AI-generated |
| **Navigation/search assistance** | Relevance-ranked search results, suggested navigation paths, or contextual links | No — informational only | No explicit review gate, but output must be marked as AI-assisted |
| **Operational recommendations** | Configuration suggestions, troubleshooting steps, or onboarding guidance for operators | Only after operator review and explicit action | Yes — operator must act, not auto-applied |

### 8.2 Output governance rules

1. **All outputs are assistive until reviewed.** No AI output is authoritative until a qualified human has reviewed and approved it for its intended purpose.
2. **Outputs that may enter the record require explicit approval workflows.** Draft text, coding hints, and candidate translations are not automatically promoted.
3. **Advisory outputs must be visually distinguishable.** Any AI-generated content displayed to users must be clearly identifiable as AI-generated (label, icon, styling, or other clear signal).
4. **Output attribution required.** When AI-generated content enters a record, the audit trail must record that it originated from an AI assist feature, which assist class produced it, and who approved it.
5. **No output laundering.** AI output must not be passed through intermediate steps that obscure its AI origin before entering a governed record.

---

## 9. Human review and approval model

### 9.1 Review boundary table

| Assist class | Output type | Review required? | Who reviews? | Record entry allowed? |
|-------------|------------|-----------------|-------------|---------------------|
| Intake assist | Suggested questions | Advisory — no explicit review gate | Clinician reviews completed intake | No direct record entry from suggestions |
| Scribe/draft assist | Draft notes | **Mandatory before sign** | Clinician (author of record) | Yes — after review and signature |
| Coding/documentation assist | Code suggestions | **Mandatory before assignment** | Coder or clinician | Yes — after acceptance |
| Translation assist | Candidate translations | **Mandatory before activation** | Translator + clinician-linguist for clinical content | Yes — after review and activation |
| Summarization/search assist | Summaries, search results | Advisory — no record entry | End user (informational use only) | No — advisory only |
| Specialty workflow assist | Ranked options, flags | **Mandatory before action** | Specialty clinician | Action taken through normal clinical workflow |
| Operations/support assist | Configuration suggestions | **Mandatory before application** | Operator | Applied through governed configuration paths |

### 9.2 Approval principles

1. **Approval is an affirmative act.** The user must actively approve AI-generated content. Approval cannot be inferred from inaction, timeout, or navigation away.
2. **Approval is scoped.** Approving a draft note does not approve embedded coding suggestions. Each output type that enters a record requires its own approval.
3. **Approval does not transfer responsibility.** The approving human bears professional responsibility for the approved content. AI does not absorb blame or liability.
4. **Approval is audited.** Every approval (and rejection) is recorded in the audit trail with the approver's identity, timestamp, and the content that was approved.

### 9.3 Clinician responsibility

The clinician who reviews and signs AI-generated clinical content (notes, orders, assessments) bears the same professional responsibility as if they had authored the content manually. The AI assist feature:

- Does not reduce the clinician's duty of care.
- Does not serve as a second opinion or peer review.
- Does not transfer liability to the software vendor or AI provider.
- Must be clearly understood by the clinician as a draft that requires their professional judgment.

---

## 10. Write-back and record-entry rules

### 10.1 Write-back posture table

| Scenario | Write-back allowed? | Conditions |
|----------|-------------------|------------|
| AI draft text → VistA TIU note | Yes | Clinician reviews, edits, and signs the note through the normal TIU signature workflow |
| AI code suggestion → billing claim | Yes | Coder reviews and accepts the code through the governed coding workflow |
| AI translation → language pack content | Yes | Translator reviews and activates through the content lifecycle workflow (specialty-content §9) |
| AI summary → patient chart | **No** | Summaries are advisory display content, not chart entries |
| AI search result → any record | **No** | Search results are navigational, not records |
| AI configuration suggestion → system config | Yes | Operator reviews and applies through governed config paths |
| AI-generated anything → VistA globals directly | **Never** | All writes go through governed API paths with human approval |

### 10.2 Write-back principles

1. **No direct AI → VistA writes.** AI processes must never write directly to VistA globals, files, or data dictionaries. All VistA writes go through the governed write path: clinician approval → platform API → VistA adapter → VistA RPC → VistA globals (global-arch §11, pack-adapter §20).
2. **Draft context only.** AI output may be placed into draft contexts (e.g., a draft note buffer, a suggestion panel, a candidate list) before review. Draft contexts are not records of truth.
3. **Approval transitions draft to record.** The act of human approval is what transitions AI-generated content from draft to record. The implementation must make this transition explicit and auditable.
4. **Write-back audit trail.** Every write-back that originated from AI assist must be tagged with: assist class, AI generation timestamp, review timestamp, approver identity, and original AI output hash for traceability.

### 10.3 VistA truth boundary

VistA remains the source of truth for clinical and operational data (global-arch §6, distro runtime-truth). AI assist features:

- **Read** VistA data through governed APIs and adapters.
- **Generate** draft/advisory content based on that data.
- **Present** drafts to qualified humans for review.
- **Write** only when a human has approved, through the governed VistA write path.

AI output stored in platform-side draft buffers or processing caches does NOT become clinical truth. Only data that has passed through the governed write path and resides in VistA globals is clinical truth.

---

## 11. Storage, retention, and PHI rules

### 11.1 Storage posture table

| Data category | Storage allowed? | Retention posture | PHI handling |
|--------------|-----------------|-------------------|-------------|
| AI prompts containing PHI | Transient processing only | Purge after processing completes or after a short governed retention window. No indefinite retention. | Minimum-necessary. Audit access. |
| AI responses / generated content | Transient until reviewed | Draft content purged after review cycle completes (approved content enters the record through normal paths; rejected content is purged). | Same classification as input data. |
| Model inference metadata (latency, tokens, model version) | May be retained for operational metrics | Governed retention per operational data policy. No PHI in metadata. | None — operational data only |
| Embedding vectors from patient data | Transient processing only | Must not be retained beyond the immediate processing request unless explicitly governed and audited. | Embeddings derived from PHI are treated as PHI. |
| Conversation / session history | Session-scoped only | Purge when session ends or within a short governed window. No indefinite conversation retention. | If session includes PHI, PHI handling rules apply. |
| Audit records of AI actions | Retained per audit policy | Retained alongside other clinical and operational audit records. | Audit records must NOT contain the full AI prompt/response content. Record metadata and classification only. |

### 11.2 PHI handling principles

1. **Minimum-necessary processing.** AI processing requests include only the data fields required for the specific assist task.
2. **No casual PHI duplication.** AI processing pipelines must not create additional copies of PHI beyond what is necessary for the immediate processing step (specialty-content-analytics §12.1).
3. **De-identification where possible.** If an assist task can be accomplished with de-identified data, PHI must not be used.
4. **No PHI in model training.** Patient data must never be sent to model training, fine-tuning, or evaluation pipelines without explicit governance review and patient consent frameworks (global-arch §16).
5. **No PHI in metric labels.** AI performance metrics (accuracy, latency, usage counts) must not use patient identifiers, encounter identifiers, or other PHI as dimension keys or labels (specialty-content-analytics §12.1).

### 11.3 Minimum-necessary retention

Retention decisions must answer:

- **What** is being retained? (prompt, response, metadata, embedding)
- **Why** is retention necessary? (processing, audit, quality measurement)
- **How long?** (session-scoped, hours, days, per audit retention policy)
- **Who** has access? (processing service only, audit reviewers, operators)
- **How** is it purged? (automatic timer, session end, explicit purge)

Detailed retention schedules require legal and compliance input and are deferred to implementation-time governance. This spec establishes the principles; schedules are downstream.

### 11.4 No casual provider-side leakage

When AI processing involves external providers (cloud APIs, third-party services):

1. **Provider data retention policies must be known and documented** before an assist class is activated with that provider.
2. **Providers that retain prompt/response data for training** must not be used for assist classes that process PHI unless explicit governance controls (opt-out, data processing agreements, BAA) are in place.
3. **Provider changes are governance decisions** (see Section 12), not silent infrastructure swaps.

---

## 12. Provider and model posture

### 12.1 Provider posture classes

| Posture class | Description | PHI handling | Latency profile | Auditability | Suitable for |
|--------------|-------------|-------------|-----------------|-------------|-------------|
| **Local/on-premise** | Model runs within the deployment boundary (on-premise, private cloud, dedicated infrastructure) | PHI stays within the deployment boundary. Maximum control over data residency. | Lowest latency. No internet dependency. | Full — all processing within governed infrastructure. | All assist classes, especially high-PHI classes (scribe, summarization, specialty) |
| **Private cloud** | Model runs in a dedicated, contracted cloud environment with data processing agreements | PHI governed by DPA/BAA. Data residency contractually bound. | Low-to-moderate latency. Internet dependency. | High — contractual audit rights. Provider logs may be available. | Most assist classes with appropriate DPA/BAA |
| **Public cloud API** | Model accessed via public API (e.g., commercial LLM APIs) | PHI requires BAA, opt-out of training, data residency guarantees. May not be suitable for all PHI classes. | Moderate latency. Internet dependency. Rate limits. | Moderate — provider-dependent. API logs. Limited internal visibility. | Operations/support, translation (non-PHI content), search assistance |
| **Hybrid** | Different provider postures for different assist classes or different data sensitivity levels | Per-class PHI handling based on the posture selected for each class. | Varies by class. | Varies by class. | When different assist classes have different sensitivity requirements |

### 12.2 Provider governance rules

1. **Provider selection is a governance decision.** Choosing or changing an AI provider requires architectural review, not just a developer decision or environment variable change.
2. **PHI sensitivity determines minimum posture.** Assist classes with high PHI exposure (scribe, summarization, specialty) require at minimum private-cloud or local posture. Public cloud APIs require explicit governance review for any PHI-processing assist class.
3. **Provider capability must be documented.** For each provider used, document: data retention policy, training data policy, BAA/DPA status, audit log availability, geographic data residency, and model versioning policy.
4. **Model version changes are auditable.** Switching model versions, even within the same provider, must be recorded in the audit trail and may require re-validation of assist quality.
5. **No silent provider fallback.** If the primary provider is unavailable, the system must not silently route requests to a different provider with a different governance posture. Fallback behavior follows Section 13 rules.

### 12.3 Why provider choice is a governance decision

Provider choice is NOT purely a developer convenience or performance optimization decision because:

- **PHI handling varies by provider.** Some providers retain data, some do not. Some have BAAs, some do not.
- **Auditability varies.** Some providers offer detailed audit logs; others offer none.
- **Data residency varies.** Some providers process data in specific geographic regions; others do not guarantee residency.
- **Retention varies.** Some providers retain prompts/responses for model improvement; opt-out mechanisms vary.
- **Cost and latency vary.** But cost and latency must NOT override governance constraints.

---

## 13. Failure behavior and fallback rules

### 13.1 Failure principles

1. **AI failure is never a clinical failure.** If the AI service is unavailable, clinical workflows continue without AI assist. No clinical operation depends on AI availability.
2. **Failure must be visible.** Users must see that AI assist is unavailable. Silent failure — where the assist feature disappears without notification — is a boundary violation.
3. **No degradation to unchecked output.** If the AI service degrades (slower, lower quality, partial responses), the system must not silently lower the review threshold. Review requirements are fixed regardless of AI service quality.
4. **No retry storms.** Failed AI requests must not trigger unbounded retries that degrade system performance.
5. **Failure is logged.** AI service failures are recorded in operational logs with enough detail for troubleshooting but without PHI.

### 13.2 Degradation posture table

| Failure scenario | System behavior | User experience |
|-----------------|-----------------|-----------------|
| AI service completely unavailable | Assist feature is disabled. Workflow continues without AI. | Clear indicator that AI assist is currently unavailable. All manual workflows remain functional. |
| AI service responding slowly | Request times out per configured threshold. No indefinite waiting. | Timeout message. User may proceed manually or retry. |
| AI service returning errors | Error is caught, logged, and reported. No error content displayed as AI output. | Error indicator. User proceeds manually. |
| AI service returning low-confidence output | Output is still presented as draft (confidence indicators where available), but review requirements are not relaxed. | Same review process. Confidence information may be displayed if the assist class supports it. |
| AI provider changed without governance | **This must not happen.** Provider changes require governance review (Section 12). | N/A — prevented by governance, not handled at runtime. |

---

## 14. Audit and traceability rules

### 14.1 Auditable events table

| Event | What is recorded | Who is accountable |
|-------|-----------------|-------------------|
| **AI assist invocation** | Assist class, user identity, patient context (if applicable), input data classification, timestamp | System (automatic) |
| **AI output generated** | Assist class, output classification, model/provider (identifier, not full config), generation timestamp, content hash (not full content) | System (automatic) |
| **Human review started** | Reviewer identity, output reference, review start timestamp | Reviewer |
| **Human approval** | Approver identity, output reference, approval timestamp, destination (which record the content enters) | Approver |
| **Human rejection** | Rejector identity, output reference, rejection timestamp, rejection reason (optional) | Rejector |
| **Write-back to record** | Source assist class, approver identity, destination record reference, write timestamp, content hash | System + approver |
| **AI service failure** | Failure type, assist class, timestamp, error classification (not full error with PHI) | System (automatic) |
| **Provider/model change** | Old provider/model, new provider/model, change timestamp, authorizer identity | Operator |
| **Assist class activation/deactivation** | Assist class, activation scope, timestamp, authorizer identity | Operator |

### 14.2 Audit principles

1. **Audit is non-negotiable.** No AI assist feature may operate without audit logging. This is not a "nice-to-have" that can be deferred to v2.
2. **Audit records do not contain full AI content.** Audit entries record metadata, classifications, hashes, and references — not the full text of prompts and responses. This avoids creating a secondary PHI store in the audit trail.
3. **Audit records are immutable.** Once written, audit entries are append-only and hash-chained per the platform's immutable audit model.
4. **Audit retention follows platform policy.** AI audit records are retained alongside other clinical and operational audit records, not in a separate shorter-lived store.
5. **Audit is the mechanism for traceability.** If a clinician asks "where did this text come from?" the audit trail must be able to trace: AI assist class → generation event → review event → approval event → write-back event.

---

## 15. Claim and marketing boundaries for AI features

### 15.1 Claim-gating alignment

AI features are capabilities. They follow capability-truth claim-gating rules (capability-truth §11):

- **No public claim without verified evidence.** An AI assist feature must reach at least "verified" readiness state before any public surface (website, sales material, documentation) may state it is available.
- **Verified scope must be declared.** "AI-assisted note drafting verified for outpatient primary care encounters" is a valid claim. "AI-powered documentation" without scope is not.
- **Pilot-scope proof is not general availability.** If an AI feature was verified in a pilot with one specialty at one facility, the claim must reflect that scope.

### 15.2 Forbidden claim patterns

| Forbidden claim | Why |
|----------------|-----|
| "AI-powered EHR" | Overbroad. Does not specify which assist classes, scopes, or readiness states. |
| "Automated clinical documentation" | Implies autonomous documentation without review. Scribe assist is draft-only with mandatory review. |
| "AI diagnoses" | Autonomous diagnosis is explicitly forbidden (Section 4). |
| "Smart orders" that imply autonomous ordering | AI may suggest; clinicians order. Claiming "smart orders" without specifying the review boundary is misleading. |
| "Multilingual AI" without language-specific readiness | Each language requires its own readiness verification. "Multilingual" must specify which languages at what maturity level. |
| Presenting planned AI features as available | Roadmap items are not capabilities. "Coming soon" must be visually distinct from "available." |

### 15.3 Readiness state requirements for AI claims

| Claim surface | Minimum AI feature readiness | Additional requirement |
|--------------|-----------------------------|-----------------------|
| Public website | Claimable | Scope bounds visible |
| Sales/partnership | Claimable | Pilot scope labeled where applicable |
| Onboarding/signup | Verified and eligible for the tenant's scope | Non-eligible AI features not shown |
| Control-plane provisioning | Implemented (for pilot enablement) | Full readiness detail visible to operator |
| Tenant-admin enablement | Activated and eligible | Partial support labeled |
| Internal roadmap | Any state | State clearly labeled |
| Support documentation | Verified | Known limitations documented |

---

## 16. Workspace and screen-contract implications

### 16.1 Workspace placement rules for AI surfaces

AI assist features appear within existing workspaces, not in a separate "AI workspace." The workspace placement follows the assist class:

| Assist class | Expected workspace placement |
|-------------|----------------------------|
| Intake assist | Clinical workspace (intake is a clinical workflow) |
| Scribe/draft assist | Clinical workspace (note authoring is a clinical workflow) |
| Coding/documentation assist | Revenue cycle workspace (coding is a revenue cycle workflow) or clinical workspace (if used by clinicians during encounters) |
| Translation assist | Tenant-admin workspace (content administration per workspace-map §16) |
| Summarization/search assist | Clinical workspace (patient context) or analytics workspace (aggregate summaries) |
| Specialty workflow assist | Clinical workspace or ancillary workspace (depends on the specialty) |
| Operations/support assist | Control-plane workspace or IT/integration workspace |

### 16.2 Screen contract requirements for AI surfaces

Every AI assist surface must have a screen contract (`packages/contracts/schemas/screen-contract.schema.json`) that declares:

| Screen contract field | AI-specific requirement |
|----------------------|----------------------|
| `surfaceType` | Must reflect the surface's function (e.g., `"clinical"` for scribe assist, `"admin"` for operations assist) |
| `dataClassification` | Must be `"phi"` for any assist class that processes patient data. `phiGovernance` declaration required. |
| `readWritePosture` | `"read-only"` for advisory-only surfaces. `"controlled-write"` for surfaces where approved AI output may enter records. Never `"mixed"` without explicit justification. |
| `accessRequirements` | Must include the appropriate role categories for the assist class. Scribe assist: `"clinician"`. Coding assist: `"revenue-cycle-staff"` or `"clinician"`. Operations assist: `"platform-operator"` or `"it-integration"`. |
| `refreshBehavior` | Typically `"on-demand"` (AI generates when requested) or `"real-time"` (for inline suggestions). |
| `claimSurface` | If the surface is used to market or claim an AI capability, claim-surface declaration with `gatingRuleRef` is required. |

### 16.3 Cross-workspace transition contracts

If an AI assist feature triggers a cross-workspace transition (e.g., a coding suggestion in the clinical workspace leads to the revenue cycle workspace for claim review), the transition must follow workspace-map §10 rules:

- Context parameters (patient ID, encounter reference) are passed explicitly.
- Access is re-evaluated at the target workspace boundary.
- The transition is declared in both surfaces' screen contracts.

---

## 17. Safety and anti-drift constraints

### 17.1 Architectural invariants

These constraints are non-negotiable and apply to all AI assist work in VistA Evolved.

1. **AI does not become truth.** VistA is the clinical and operational source of truth. AI output is draft, advisory, or assistive until a human makes it part of the governed record.
2. **Review boundaries do not erode.** No implementation, performance optimization, or workflow shortcut may weaken the human review requirements defined in Section 9.
3. **Audit is always on.** No AI assist feature operates without audit logging. There is no "audit later" or "audit in v2."
4. **Failure is visible.** Users always know when AI assist is unavailable. Silent disappearance of AI features is a boundary violation.
5. **Provider governance is enforced.** No provider change without governance review. No silent fallback to a different provider.
6. **PHI handling is not optional.** Every AI assist feature that processes PHI must declare its PHI posture in its screen contract and follow the storage/retention rules in Section 11.
7. **Claims follow truth.** AI feature claims on any surface follow the same claim-gating rules as any other capability. No exceptions for "AI features are different."
8. **One truth, one write path.** AI-influenced writes to VistA go through the same governed write path as any other write. There is no "AI fast path" that bypasses adapters, RPCs, or approval gates.

### 17.2 Operator and developer responsibilities

| Role | Responsibility |
|------|---------------|
| **Operator** | Responsible for activating/deactivating AI assist classes per tenant. Responsible for provider configuration. Responsible for reviewing AI feature readiness before activation. |
| **Developer** | Responsible for implementing AI assist features within the governance boundaries defined here. Must map features to assist classes. Must implement audit logging. Must implement review workflows. Must not bypass provider posture or write-back rules. |
| **Clinician** | Responsible for reviewing and approving AI-generated clinical content before it enters the record. Bears professional responsibility for approved content. |
| **Coder/biller** | Responsible for reviewing and accepting AI-generated coding suggestions before they affect billing records. |
| **Translator** | Responsible for reviewing and approving AI-generated translations before they enter the content lifecycle. Medical/clinical translations require clinician-linguist review. |

---

## 18. Resolved now vs deferred later

| Decision | Status | Notes |
|----------|--------|-------|
| AI assist taxonomy (7 classes) | **Resolved** | Section 6 |
| Input class governance model | **Resolved** | Section 7 |
| Output class governance model | **Resolved** | Section 8 |
| Human review/approval model | **Resolved** | Section 9 |
| Write-back rules | **Resolved** | Section 10 |
| VistA truth boundary for AI | **Resolved** | Section 10.3 |
| Storage/retention principles | **Resolved** | Section 11 |
| PHI handling principles | **Resolved** | Section 11.2 |
| Provider posture classes | **Resolved** | Section 12 |
| Provider governance rules | **Resolved** | Section 12.2 |
| Failure behavior principles | **Resolved** | Section 13 |
| Audit event taxonomy | **Resolved** | Section 14 |
| Claim-gating alignment | **Resolved** | Section 15 |
| Workspace placement mapping | **Resolved** | Section 16 |
| Screen contract requirements for AI | **Resolved** | Section 16.2 |
| Anti-drift constraints | **Resolved** | Section 17 |
| Concrete model registry schema | **Deferred** | Requires implementation-phase design |
| AI service API contract (OpenAPI) | **Deferred** | Requires service boundary decisions |
| Provider integration code | **Deferred** | Downstream of provider posture decisions |
| Prompt template governance | **Deferred** | Requires per-class design |
| Detailed retention schedules | **Deferred** | Requires legal/compliance input |
| Automated policy engine | **Deferred** | Runtime enforcement is downstream of this spec |
| UI panel designs for AI surfaces | **Deferred** | Requires screen inventory (not authorized) |
| Consent framework for AI-processed PHI | **Deferred** | Requires legal/compliance + patient-facing design |
| Fine-grained permission matrix for AI | **Deferred** | Extends the deferred access-control specification |

---

## 19. Explicit out-of-scope / not authorized yet

| Item | Status | Reason |
|------|--------|--------|
| Concrete model registry schema | Not authorized | Implementation artifact, not architecture governance |
| AI service endpoints (OpenAPI/AsyncAPI) | Not authorized | Service contract, downstream of this spec |
| Provider integration code | Not authorized | Implementation, downstream of provider posture |
| Prompt templates or prompt engineering patterns | Not authorized | Implementation detail, not safety architecture |
| UI panels or components for AI surfaces | Not authorized | UI implementation, not authorized by this spec |
| Automated policy engine for AI decisions | Not authorized | Runtime implementation, downstream |
| Detailed data retention schedules | Not authorized | Requires legal/compliance input beyond architecture |
| Autonomous clinical decision-making | **Explicitly forbidden** | Global-arch §19, this spec §4 |
| AI-generated content as unreviewed truth | **Explicitly forbidden** | This spec §4, §10 |
| AI training on patient data without consent | **Explicitly forbidden** | Global-arch §16, this spec §11.2 |

---

## 20. Next artifact handoff

This is the final artifact in the initial governed artifact pipeline (global-system-architecture-spec.md §20, items 1–8). With all 8 artifacts accepted, the architecture backbone is complete.

### What this spec resolves for future work

This spec provides the governance framework that constrains all future AI assist implementation:

1. **Assist class taxonomy** — future AI features must map to one of the 7 defined classes or request a taxonomy amendment.
2. **Input/output governance** — implementation contracts can reference this spec's input/output class tables for their allowed data flows.
3. **Review model** — implementation designs for AI-assisted workflows must implement the review boundaries defined in Section 9.
4. **Write-back rules** — VistA integration patterns for AI-originated writes must follow Section 10.
5. **Provider posture** — provider selection and configuration must follow Section 12 governance.
6. **Screen contracts** — AI assist surfaces must have screen contracts per Section 16.2.
7. **Audit requirements** — audit logging per Section 14 is non-negotiable for any AI assist implementation.
8. **Claim-gating** — marketing and public claims about AI features must follow Section 15.

### Recommended next practical artifacts

With the 8-spec architecture backbone complete, the next practical governance and design artifacts should include:

| Artifact | Purpose | Relationship to backbone |
|----------|---------|------------------------|
| **Screen inventory** | Catalog of concrete screens/surfaces per workspace | Consumes workspace-map (§7), screen-contract schema, and this spec (§16) |
| **Permissions matrix** | Fine-grained role-to-action mapping per workspace | Consumes workspace-map (§8), org-facility model, this spec (§9) |
| **Pack visibility rules** | What packs/capabilities are visible per tenant, role, scope | Consumes capability-truth (§11, §16), pack-adapter governance, country-payer registry |
| **State model implementation** | Concrete state machine for capabilities and AI assist features | Consumes capability-truth (§7), this spec (§6.2) |
| **Acceptance criteria per milestone** | Verifiable criteria for each implementation slice | Consumes governed-build-protocol, this spec (§17) |

!!! warning "Sequencing discipline"
    The architecture backbone is now complete. Practical artifacts should be authored one at a time with proof and review between each, following the governed build protocol.
