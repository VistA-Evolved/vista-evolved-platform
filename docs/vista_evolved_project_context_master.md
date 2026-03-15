# VistA Evolved — Master Project Context, Memory, and Working Constitution

This document is meant to be used as durable context for ChatGPT projects, AI coding agents, and future chats about this project.

Its purpose is to prevent drift, memory loss, shallow assumptions, and uncontrolled feature generation.

If a future AI tool or future chat has limited context, this document should be treated as the stable background memory for the project.

---

## 1. Project identity and mission

The project is a long-term effort to modernize VistA into a serious, commercially viable, enterprise-capable, presentation-ready, and eventually production-ready web platform.

The intended end state is not a toy demo. The intended end state is a real hospital/clinic platform that can:
- use real VistA as the operational/clinical source of truth where VistA already owns the data,
- support real browser-based access to authentic VistA roll-and-scroll workflows,
- provide carefully planned modern web UI and UX on top of those workflows,
- support small clinics, larger hospitals, and multi-facility organizations,
- later support patient portal, telehealth, revenue cycle, imaging, specialty workflows, and other major modules,
- be organized so real human product teams, engineers, and operators can understand, own, and safely extend it.

This project must not drift into a giant AI-generated blob.

---

## 2. User profile and working style

The project owner is not a programmer, not a software developer, not a database engineer, and not a DevOps expert.

The project owner works primarily by:
- using AI coding tools such as VS Code / Cursor / Copilot style agents,
- giving prompts/instructions to the AI coder,
- having the AI create and modify code, scripts, docs, and repo structure,
- reviewing outputs, UI, behavior, and progress,
- relying on ChatGPT to engineer precise prompts and system rules.

Because of this, all guidance for this project should be written in a way that is useful for an AI coding agent.

That means:
- instructions must be explicit,
- ambiguity must be minimized,
- the AI must be forced to verify,
- the AI must not claim work is done without proof,
- the AI must stop between stages and wait for human review,
- the AI must not silently widen scope.

The project owner wants highly detailed, highly structured prompts that can be pasted into an AI tool and executed step by step.

---

## 3. What happened in the original repo and why this reset is necessary

A very large original repo was built through rapid AI-assisted coding over many phases, waves, prompts, and experiments.

That repo contains a lot of real work, but also created major problems:
- fragmented context,
- too many parallel directions,
- unclear sequencing,
- broad UI surfaces that feel unplanned,
- many features that appear present but are not fully proven,
- inconsistent runtime assumptions,
- placeholder behavior, stubs, or incomplete wiring in some areas,
- broad documentation sprawl,
- prompt history drift,
- uncertainty about what is real, partial, broken, fake, or only planned.

The project owner correctly observed that the repo felt like it was “spinning in circles.”

The deeper lesson is:

**AI can generate code very quickly, but without governance, proof, runtime discipline, and a clear product center, it produces surface area faster than truth.**

That is why a controlled reset is necessary.

---

## 4. Core insight that changed the direction of the project

The project should not begin by broadly rebuilding CPRS or randomly expanding GUI surfaces.

The project should begin from **VistA truth**.

That means the development center of gravity should be:
1. real VistA upstream source control,
2. a custom local VistA runtime,
3. authentic browser-based roll-and-scroll terminal access,
4. proof that real communication with VistA works,
5. only then slow, research-backed GUI slices,
6. each slice verified against live VistA truth.

The original repo over-indexed on broad surface building.

The new plan is to rebuild slowly, slice by slice, with proof.

---

## 5. Strategic conclusions that were reached

The following decisions are now part of the project’s working constitution.

### 5.1 Archive the old repo

The original large repo should be preserved as:
- archive,
- salvage source,
- historical lessons learned,
- reusable code source,
- evidence of what was tried.

It should **not** remain the canonical product repo.

### 5.2 Use a clean restart

A clean restart is recommended, but not a reset of knowledge.

This is a reset of product surface and repo structure, not a reset of method.

### 5.3 Use three repos, not one giant blob and not one repo per module

The current best recommendation is:

1. `vista-evolved-archive`
   - frozen old repo
   - salvage/reference only

2. `vista-evolved-platform`
   - the new clean canonical platform monorepo
   - all web/API/product code, contracts, docs, ownership metadata, tests, generated SDKs, and controlled product slices

3. `vista-evolved-vista-distro`
   - separate repo for VistA runtime and distro concerns
   - pinned WorldVistA upstreams
   - YottaDB/VistA Docker builds
   - overlay routines
   - installer/build scripts
   - runtime verification

### 5.4 Do not create one repo per module/team

Modules like patient portal, telehealth, revenue cycle, clinical UI, admin console, imaging, and specialty workflows should **not** each become separate repos by default.

Instead, they should become **bounded contexts inside the platform monorepo**, with:
- clear ownership,
- contracts,
- manifests,
- tests,
- README,
- CI gates,
- boundary rules.

### 5.5 The starting point should be admin, but split into two layers

The plan evolved from “start with admin” into a more precise recommendation:

#### Layer A: Platform control plane admin
This is the SaaS/business side.

It includes:
- customer signup,
- tenant creation,
- facility type selection,
- capability/module selection,
- environment provisioning,
- organization-level administration,
- initial bootstrap admin user.

#### Layer B: Tenant operational admin
This is the VistA-backed in-product admin side.

It includes:
- users,
- roles/security keys,
- divisions,
- clinics,
- wards,
- rooms/beds,
- printers/devices,
- site/security settings,
- later operational visibility and basic management.

This split is critical because the product is both:
- a SaaS/business platform, and
- a VistA-backed healthcare runtime.

---

## 6. Vision for what the product must eventually support

The end-state product may eventually include:
- admin/control plane,
- tenant admin,
- modern clinician UI,
- browser roll-and-scroll terminal,
- patient portal,
- telehealth,
- revenue cycle management,
- claims/billing,
- imaging,
- laboratory,
- pharmacy,
- admissions/ADT,
- inventory,
- dietary,
- specialty workflows,
- analytics/executive views,
- training guides/manuals,
- configurable themes/layouts,
- multi-facility support,
- offline-aware policies where appropriate,
- later mobile/PWA/native strategies where appropriate.

But **none of this should be built broadly at the start.**

The project must begin with the foundational layers that preserve truth and make later modules safe to build.

---

## 7. Why roll-and-scroll matters so much

A central insight in this project is that VistA already exists as a deep, mature system and that much of its operational truth is already present in roll-and-scroll, FileMan, Kernel, List Manager, and package-specific workflows.

The project owner strongly believes, correctly, that:
- roll-and-scroll contains a great deal of the real system behavior,
- it includes much more than CPRS-style GUI areas,
- it includes administration, setup, and operational functions,
- it can serve as the behavioral truth baseline,
- modern GUI layers should be built only after understanding that truth.

The project owner is not a VistA expert and wants the AI to help:
- read manuals,
- read technical docs,
- understand terminal workflows,
- suggest commands to run,
- interpret what the terminal is doing,
- later translate that into carefully planned GUI.

This is a key part of the future methodology.

---

## 8. Upstream VistA source strategy

The current recommended upstream strategy is:

### Canonical upstreams
- `WorldVistA/VistA-M` = baseline M source tree
- `WorldVistA/VistA` = broader patches/tests/tools tree
- `WorldVistA/VistA-VEHU-M` = optional seeded/redacted demo/test dataset lane
- `WorldVistA/docker-vista` = reference/recipe only, not canonical product truth

### Key rule
The project should use **local-source-first** workflows.

That means:
- upstream repos are downloaded locally once,
- pinned to exact commits,
- reused for repeated build/debug cycles,
- not re-downloaded every time a Docker build fails.

This is a major anti-chaos rule.

### Why
The project owner specifically wants to avoid a loop where the AI repeatedly downloads upstream sources again and again during broken Docker/build attempts.

---

## 9. Local-first Docker/runtime rule

The custom VistA runtime should be built from **local pinned upstream sources**, not from ad hoc network pulls during each build.

The workflow should be:
1. fetch/clone upstreams locally,
2. pin SHAs,
3. build Docker from local folders,
4. debug against the same local folders,
5. only refresh upstreams intentionally.

This rule already proved useful during the original repo extraction work.

---

## 10. What was actually proven in the old repo during the extraction/guided stages

During a guided governed-build sequence inside the old repo, several important things were achieved.

These stages matter because they produced **method**, even if they do not become the final product repo.

### Stage 1 — Governance installed
The old repo gained:
- governance docs,
- canonical/source-of-truth docs,
- status labels,
- governed build protocol,
- verification standard,
- prompt recovery plan,
- AI rule files,
- root governance summary.

### Stage 2 — Upstream source pinning/fetch system created
The old repo gained:
- upstream config,
- local fetch/pin scripts,
- lock file support,
- vendor/upstream structure,
- docs for local-source workflows.

### Stage 3 — Custom local-source Docker lane built
The old repo gained:
- custom VistA Docker build files,
- compose profile,
- runtime scripts,
- runtime docs,
- proof that a Docker image could be built from local vendored WorldVistA sources only.

### Stage 4 — Runtime readiness framework established
The old repo gained explicit readiness levels:
- `CONTAINER_STARTED`
- `NETWORK_REACHABLE`
- `SERVICE_READY`
- `TERMINAL_READY`
- `RPC_READY`

This helped expose false confidence and port conflicts.

### Stage 5 — Browser roll-and-scroll path was mapped and proven enough
The old repo already had terminal-related code, and the guided work documented and partially proved it.

Important existing files in the old repo included:
- `apps/api/src/routes/ws-terminal.ts`
- `apps/web/src/components/terminal/VistaSshTerminal.tsx`
- `apps/web/src/app/cprs/vista-workspace/page.tsx`

Additional docs/tests/proof artifacts were created.

Later proof improved further and reached the following state:
- upstream lock file populated with real SHAs,
- local runtime readiness passed all 5 readiness levels,
- browser terminal Playwright proof passed,
- live WebSocket session established,
- typed terminal input sent,
- session remained connected.

### Specific pinned SHAs from the old repo proof work
These were reported during the old repo proof sequence:
- `VistA-M` = `b7aecb9029f9bb8639a7bfa63b635469065ab44d`
- `VistA` = `6c18f1bf98a3c2b33aa0c61ced6282a42c72e1aa`

These are historical proof points from the extraction work and may need to be re-pinned in the new distro repo.

### Runtime proof details from the old repo proof work
A canonical local-vista runtime lane was proven with:
- RPC port `9433`
- SSH port `2224`

A health check reportedly passed all 5 readiness levels:
- `CONTAINER_STARTED: PASS`
- `NETWORK_REACHABLE: PASS`
- `SERVICE_READY: PASS`
- `TERMINAL_READY: PASS`
- `RPC_READY: PASS`

A Playwright live terminal proof reportedly passed with:
- browser session open,
- terminal mode selected,
- WebSocket connected,
- input typed into the terminal,
- session stability observed.

### What remained unverified even after that proof
Even with that proof, some items were still marked as not perfect or still recommended for manual validation:
- exact terminal text/prompt assertions were limited by xterm canvas rendering,
- manual sign-in/interaction validation remained recommended,
- copy/paste/resize/manual fidelity still deserved human testing,
- VEHU was not the main proven lane in that proof sequence.

These caveats are important. Do not overclaim.

---

## 11. Why the plan changed from “keep going in the old repo” to “clean restart”

The recommendation evolved over the conversation.

### Earlier recommendation
At first, the recommendation was to stay in the current repo long enough to extract:
- governance,
- runtime truth,
- upstream pinning,
- terminal proof,
- a disciplined method.

That was the right move at the time.

### Later recommendation
Once enough method had been extracted, the recommendation changed:
- freeze the old repo,
- start a clean canonical rebuild,
- carry forward only the proven process assets,
- do not continue to build the final product inside the giant confusing repo.

This change was made intentionally and should be preserved in memory.

---

## 12. The new intended repo architecture

### 12.1 `vista-evolved-archive`
Frozen original repo.

Purpose:
- archive,
- reference,
- salvage,
- evidence,
- reusable code source.

Rules:
- no new canonical product work here,
- no new broad feature generation here,
- only selective extraction of proven process assets or proven reusable components.

### 12.2 `vista-evolved-platform`
New clean canonical monorepo.

Purpose:
- product web apps,
- API/BFF,
- contracts,
- design system,
- docs,
- manifests,
- ownership metadata,
- tests,
- generated SDKs,
- controlled slice-by-slice product build.

### 12.3 `vista-evolved-vista-distro`
Separate VistA distro/runtime repo.

Purpose:
- upstream pins,
- overlay routines,
- Docker/runtime build,
- M code changes,
- custom installer/build scripts,
- runtime proof,
- VistA-specific operational documentation.

---

## 13. Recommended structure of the new platform repo

The general direction recommended for the platform repo is:

```text
vista-evolved-platform/
  apps/
    control-plane/
    admin-console/
    clinician-web/        # later
    patient-portal/       # later
  services/
    api-bff/
    integration-hl7/      # later
    integration-imaging/  # later
    integration-telehealth/ # later
  packages/
    contracts/
      capability-manifests/
      openapi/
      asyncapi/
      schemas/
    config/
      ports/
      modules/
      tenants/
    domain/
      admin/
      tenancy/
      clinical/   # later
      portal/     # later
      rcm/        # later
      telehealth/ # later
      imaging/    # later
    ui/
      design-system/
    testing/
      harness/
      e2e/
  docs/
    tutorials/
    how-to/
    reference/
    explanation/
    adrs/
    runbooks/
  prompts/
    active/
    templates/
  .github/
  artifacts/
```

---

## 14. Recommended structure of the new VistA distro repo

Recommended general direction:

```text
vista-evolved-vista-distro/
  upstream/
    VistA-M/
    VistA/
    VistA-VEHU-M/    # optional lane
  overlay/
    routines/
    install/
    patches/
  docker/
    local-vista/
  scripts/
    fetch/
    pin/
    build/
    verify/
  docs/
    tutorials/
    how-to/
    reference/
    explanation/
    adrs/
    runbooks/
  artifacts/
```

### Critical overlay rule
Do not randomly edit vendored upstream trees.

Customizations should live in your controlled overlay/install/patch layers wherever possible.

---

## 15. Boundaries: modules are not repos

The project owner explicitly worried about whether telehealth, patient portal, CPRS, imaging, revenue cycle, specialties, and admin should all become separate repos.

The answer reached in the conversation was:
- **No, not by default.**
- Use one clean platform monorepo with strong boundaries and ownership instead.

Why:
- easier shared contracts,
- easier shared design system,
- easier shared CI,
- easier team ownership mapping,
- easier consistent UX,
- less fragmentation,
- less duplicated infra.

To make this work, the platform repo must enforce boundaries using:
- ownership metadata,
- code owners,
- contract packages,
- generated SDKs,
- boundary rules,
- clear manifests,
- strict docs policy.

---

## 16. Team and ownership model

The project should be organized as if real teams could own real parts of it.

Each bounded context should eventually have:
- owner(s),
- README,
- contract(s),
- capability manifest,
- tests,
- evidence/report location,
- docs location,
- explicit dependencies.

Important tools/patterns discussed:
- `CODEOWNERS` for ownership and merge control,
- software catalog metadata (Backstage-style idea) for components and ownership,
- Nx or equivalent monorepo boundary tooling for dependency rules and project graph clarity.

This is to make the repo feel human-built and team-friendly.

---

## 17. Product/control-plane vs tenant admin: the most important product split

The project must remember this split clearly.

### 17.1 Control plane
This is not VistA terminal admin. This is the SaaS/business configuration layer.

It includes:
- tenant signup,
- org creation,
- provisioning,
- module/capability selection,
- facility count/type modeling,
- environment lifecycle,
- subscription/pack configuration,
- top-level bootstrap admin creation.

### 17.2 Tenant operational admin
This is the VistA-backed admin surface inside the product.

It includes:
- users,
- roles/security keys,
- divisions,
- clinics,
- wards,
- beds,
- printers/devices,
- site parameters,
- operational structure,
- later census and operational dashboards.

This split should remain intact in the new architecture.

---

## 18. Facility size and multi-facility flexibility

The product must eventually support:
- single-doctor clinic,
- small clinic,
- rural facility,
- one-hospital organization,
- multi-hospital + multi-clinic organizations,
- different departments per tenant/facility,
- different capability packs,
- different specialties,
- different UI surface visibility based on what is enabled.

### Key conclusion
Do **not** build separate products for small clinic vs large hospital.

Instead:
- build one admin shell,
- use capability-driven navigation,
- use facility-type presets,
- use role-based and scale-based visibility,
- use manifests/contracts to determine what appears.

That preserves one system while still supporting small vs large customers.

---

## 19. Data ownership / persistence policy

The project owner strongly does **not** want:
- SQLite,
- in-memory stores pretending to be real persistence,
- JSON used as a fake database,
- PostgreSQL replacing VistA where VistA should be the source of truth.

That concern is valid and must remain part of project memory.

### Current persistence policy recommendation

#### Forbidden
- SQLite for real platform persistence
- in-memory stores for persistent state
- JSON/YAML used as operational databases

#### Allowed only for config/manifests/fixtures/evidence
- JSON
- YAML
- static config files
- schema manifests
- test fixtures
- artifact metadata

#### VistA/YottaDB should own
- clinical data already owned by VistA,
- operational/admin data already truly native to VistA,
- security/user data where Kernel/VistA already owns it,
- native roll-and-scroll workflows.

#### Platform DB (for example Postgres) should own only
- SaaS control plane records,
- tenant/subscription/provisioning metadata,
- capability enablement selections,
- integration ledgers,
- queue/job metadata,
- observability/search/indexing/analytics support stores,
- Notion sync metadata,
- other platform concerns not native to VistA.

### Important rule
Do not create a shadow clinical database when VistA is already the source of truth.

But also do not force pure SaaS/control-plane concerns into VistA just to avoid using a proper platform store.

---

## 20. How AI is allowed to touch VistA/M code

The AI may help with VistA routines, globals, wrapper code, and runtime builds, but that must happen in the **VistA distro repo**, not mixed freely into the platform repo.

Rules:
- use pinned upstreams,
- keep custom code in your overlay/customization layers,
- do not casually mutate vendored upstream trees,
- prefer using existing VistA mechanisms first,
- use wrapper routines when needed,
- avoid direct global writes from the web/API layer unless explicitly justified,
- document data ownership and justification when introducing changes.

The original repo already showed a pattern of custom `ZVE*.m` routines. That lesson supports the decision to separate VistA distro concerns into their own repo.

---

## 21. Contract system: how alignment should be enforced

The project owner wants the AI to stop improvising and to follow stable contracts.

The best answer reached was to use **multiple contract layers**, not just “Swagger” vaguely.

### 21.1 Capability contract
For each capability/module/slice, define:
- owner team,
- personas,
- facility types supported,
- source of truth,
- allowed persistence,
- offline policy,
- mobile policy,
- status,
- evidence links,
- dependencies,
- out-of-scope boundaries.

This is the product truth contract.

### 21.2 API contract
Use **OpenAPI** for HTTP APIs.

Rules:
- contract-first,
- generated SDKs,
- UI should use generated clients when available,
- CI should fail on drift,
- do not handwave “Swagger”; use proper contract discipline.

### 21.3 Async/event contract
Use **AsyncAPI** where there are WebSockets, events, or other async/message-driven boundaries.

This especially matters for terminal/websocket/event cases.

### 21.4 Config/runtime contract
Use schemas for:
- env vars,
- port registry,
- module manifests,
- tenant manifests,
- facility manifests,
- provisioning specs,
- offline/mobile policies.

### The goal
The AI should not have to “remember” what to do informally. The repo should force it through contracts and validation.

---

## 22. Port policy

A repeated pain point in the old repo was casual use of `3000`, `3001`, `3002`, which often caused collisions or confusion.

The new repo should have:
- one typed/shared port registry,
- one config source of truth,
- no hardcoded low-numbered dev defaults scattered through code,
- linting or CI checks that fail if raw ports are used outside config.

Suggested higher-range pattern discussed:
- `43100` control-plane web
- `43101` admin console
- `43102` clinician web
- `43103` patient portal
- `43110` API gateway/BFF
- `43120` telehealth signaling
- `9433` VistA broker
- `2224` VistA SSH

The exact numbers can be adjusted, but the principle must remain.

---

## 23. Documentation policy: stop documentation sprawl

One of the biggest complaints about the old repo was that AI created huge amounts of docs everywhere.

The new repo should use **one documentation model only**.

Recommended categories:
- `tutorials`
- `how-to`
- `reference`
- `explanation`
- `adrs`
- `runbooks`

This is essentially the Diátaxis approach plus ADRs/runbooks.

### Practical meaning
- training manuals = tutorials/how-to
- user manuals = tutorials/how-to + reference as appropriate
- technical manuals = reference
- architecture rationale = explanation + ADRs
- operator instructions = runbooks

### Important rule
Do not let the AI invent new random doc categories every time it works.

### Additional rule
Evidence should live in `artifacts/`, not mixed into docs folders.

---

## 24. Notion policy

The project owner has or may have a custom Notion-connected tool and wants documentation/status/manuals possibly reflected in Notion.

The conclusion reached was:

**The repo should remain the technical source of truth.**
**Notion should be a mirror / human-friendly sync target.**

Rules:
- sync only approved source docs/manifests/status outputs,
- do not free-write random Notion pages from AI,
- keep destinations fixed and intentional,
- sync on approved merge/status points rather than every experiment,
- keep technical truth in the repo.

Likely suitable Notion sync content:
- slice registry,
- ADR summaries,
- roadmap/status,
- release summaries,
- manuals index,
- ownership catalog summaries.

---

## 25. UX/UI philosophy

The project owner cares deeply about UI/UX and does not want:
- ugly admin panels,
- random layouts,
- borrowed/open-source surfaces pasted together without coherence,
- scattered country-specific billing and random analytics thrown into one giant area,
- interfaces that do not feel thoughtfully planned.

This concern is core to the project.

### Key UI/UX principles for the new build
- start from truth and workflows, not mock dashboards,
- use research-backed planning,
- use user stories,
- use role/facility-aware navigation,
- keep a uniform design language,
- do not mix unrelated visual systems,
- validate screens with screenshots and human review,
- later compare against Epic/Cerner/other systems for UX ideas, not as source-of-truth replacements,
- allow future theming/flexibility, but do not overcomplicate phase 1.

### Important nuance
The owner wants eventual support for:
- legacy-style views,
- modern views,
- possible alternate themes/layouts,
- role-based or preference-based changes.

But phase 1 should stay realistic and grounded.

---

## 26. Offline and mobile policy

The project owner raised important concerns about:
- offline mode,
- poor connectivity environments,
- mobile apps or PWA-like access.

The conclusion reached was:
- these must be considered early as policies and contracts,
- but they should **not** be built first.

Each capability should eventually declare:
- `offlinePolicy: online-only | read-cache-ok | queued-write-with-reconciliation`
- `mobilePolicy: responsive-web | PWA | native-later`

For phase 1, the recommendation is:
- control plane = online-only
- tenant admin = online-only
- browser roll-and-scroll = online-only

Do not let offline/mobile complexity derail the foundational build.

---

## 27. Technology posture

The project owner asked whether the whole stack should be reconsidered: TypeScript, JavaScript, Python, Node, etc.

The recommendation reached was:
- keep the outer platform boring and stable,
- use TypeScript + Node LTS,
- avoid adding extra languages early unless a specific justified need arises,
- do not let AI reopen the entire tech stack debate at every turn.

The important distinction is:
- platform/web/API layer = boring modern web stack,
- VistA/YottaDB/M layer = truth-bearing healthcare runtime.

---

## 28. The governed build protocol (very important)

This is one of the most important parts of the project memory.

The new project should follow a governed build protocol.

### Core rules
1. Never claim something works without proof.
2. Proof must include:
   - exact files changed,
   - exact commands run,
   - exact outputs observed,
   - exact pass/fail result.
3. No hidden fallback from real behavior to stubs/mocks/placeholders in paths labeled real.
4. No moving to the next slice without a stop-and-report stage.
5. One slice at a time.
6. Terminal verification first when relevant.
7. API/RPC verification required when relevant.
8. Browser verification required when relevant.
9. Human review checkpoint before moving on.
10. Preserve traceability.
11. Do not widen scope opportunistically.

### Slice loop
For each slice:
1. define slice,
2. define source manuals/routines/behavioral truth,
3. define user story and scope,
4. implement smallest vertical slice,
5. verify in terminal if applicable,
6. verify by RPC/API,
7. verify in browser,
8. stop,
9. human review,
10. fix from review,
11. lock evidence,
12. only then proceed.

This protocol should be treated as constitution-level guidance.

---

## 29. Build order for the clean restart

The best current phased order is:

### Phase 0 — Archive and bootstrap
- freeze old repo as archive
- create new platform repo
- create new VistA distro repo
- install governance, contracts, docs model, ownership metadata, boundary rules

### Phase 1 — Platform control plane bootstrap
- tenant/org bootstrap
- facility type + capability selection model
- provisioning manifest model
- initial control-plane structure

### Phase 2 — VistA distro bootstrap
- pin WorldVistA upstreams locally
- build custom Docker/runtime from local sources only
- runtime truth and readiness checks

### Phase 3 — Browser roll-and-scroll terminal
- authentic browser terminal path
- real VistA communication
- human and automated proof

### Phase 4 — Tenant operational admin foundation
- users
- roles/security keys
- divisions
- clinics
- wards
- rooms/beds
- printers/devices
- site settings/parameters where appropriate

### Phase 5 — Operational views
- census
- occupancy
- queues
- scheduling operations
- departmental ops summaries

### Phase 6 — Executive/BI views
- only after operations are real
- owner/CFO/high-level ops summaries

### Phase 7+ — Clinician, portal, telehealth, RCM, imaging, specialties
- one slice at a time
- no broad uncontrolled buildouts

---

## 30. Why control plane must come before full admin UI

A major correction made late in the conversation was that “admin” was too broad a label.

Because the product must allow users to sign up, choose configuration, choose facility type, and get provisioned, there is necessarily a **control-plane concern** that is separate from tenant operational admin.

If this is not handled explicitly, the product will again drift into a confused mixture of:
- business signup,
- tenant provisioning,
- VistA admin,
- CFO analytics,
- operational dashboards,
- country-specific billing,
- random modules.

This is exactly what happened in the old repo.

The control-plane split prevents that.

---

## 31. What the original repo taught about module/capability drift

From later inspection of a newer uploaded archive version, the old repo already contained:
- 6 apps,
- 10 services,
- 14 declared modules,
- 664 docs,
- 2,319 prompt files,
- 410 scripts,
- an existing `services/vista-distro`,
- an existing `docs/openapi.json`,
- an existing `scripts/notion/sync-to-notion.mjs`,
- module manifests, SKU-style configs, capability lists.

But inspection also showed that:
- the contracts were not mature enough,
- many OpenAPI responses were generic/default,
- many module manifests still indicated `in-memory`, `json-seed`, or filesystem-backed stores,
- boundaries were too loose,
- too much unrelated work was mixed together.

This confirmed the need for the restart and the stronger contract/boundary model.

---

## 32. Anti-patterns that must be avoided in the new build

The AI must remember that the following are specifically unwanted:

- uncontrolled broad feature generation,
- giant scattered admin screens,
- country-specific billing logic mixed randomly into generic admin views,
- placeholder UI in production paths,
- “done” claims without proof,
- in-memory or fake persistence in important modules,
- using JSON files as operational databases,
- random port choices,
- documentation explosions,
- blindly importing open-source UIs that clash with the rest of the product,
- broad CPRS-first rebuilding before VistA truth is established,
- silently replacing VistA truth with shadow databases,
- mixing VistA distro concerns into the general platform repo,
- copying the whole old repo into the new repo,
- putting the old repo inside the new repo as a folder.

---

## 33. What should be copied from the old repo into the new repos

Only selective proven process assets should be copied forward.

Good candidates to extract/normalize:
- governance docs,
- source-of-truth docs,
- upstream fetch/pin scripts,
- local-source Docker build scripts,
- runtime readiness/health scripts,
- terminal proof docs,
- terminal verification tests,
- port/runtime docs,
- carefully chosen reusable infrastructure pieces.

Do **not** blindly migrate:
- broad UI surfaces,
- scattered dashboards,
- large partially built modules,
- random prompt history,
- placeholder/demo business logic,
- mixed and inconsistent design surfaces.

---

## 34. How the AI should behave when given prompts for this project

When working on this project, the AI should behave like:
- senior full-stack engineer,
- release engineer,
- QA lead,
- VistA integration auditor,
- repo governance architect,
- contract disciplinarian.

It should **not** behave like a speed-optimized feature generator.

### Every response from the AI should ideally report:
- Objective
- Files inspected
- Files changed
- Commands run
- Results
- Verified truth
- Unverified areas
- Risks
- Next step

That response shape was used successfully during the extraction/proof phases and should continue.

---

## 35. Relationship between research and implementation

The owner wants the AI to research:
- VistA docs,
- roll-and-scroll manuals,
- user stories,
- how similar enterprise systems approach workflows,
- how to plan interfaces for small clinics vs large hospitals,
- open source examples where VistA does not already provide a pattern,
- business management/admin/ops needs.

That is valid.

But research must be used carefully:
- VistA docs and live behavior provide truth,
- market/competitor research provides UX inspiration,
- open-source external systems provide implementation ideas where appropriate,
- nothing should replace VistA truth when VistA already owns the operation.

---

## 36. Starting point for functional product work after bootstrap

The current best functional starting point is:

### First major product foundation
- custom VistA runtime
- browser roll-and-scroll terminal
- control-plane bootstrap

### First in-product operational slice set
Not a giant CFO dashboard.

Start with a narrowly scoped operational admin slice, then continue carefully.

Likely early slices:
- users
- roles/security keys
- divisions
- clinics
- wards/rooms/beds
- basic site/facility structure

Why:
- this grounds the system,
- this aligns with the owner’s “admin first” instinct,
- this matches real operational setup needs,
- this avoids premature analytics sprawl.

---

## 37. Security keys slice history

At one point during the old repo governance work, a planned first admin slice was proposed:
- **Security Keys / Roles Overview (read-only)**

That planning was useful because it forced bounded thinking.

However, after the strategy evolved toward the clean multi-repo restart, that old slice planning should be treated as **reference**, not automatically as the first slice of the new clean build.

The newer higher-level plan now places control-plane bootstrap and distro/runtime bootstrap first.

---

## 38. Important practical lesson: the old repo was useful because it exposed truth problems

The owner should remember this:

Even though the old repo is confusing, it was still useful.

It revealed:
- runtime inconsistency,
- port collisions,
- need for proof layers,
- the existence of a real terminal path,
- the need for source pinning,
- the need for governance,
- the need for role/capability structuring,
- the need for cleaner contracts.

So the old repo was not wasted work.

It was the prototype and learning ground that clarified the correct method.

---

## 39. Guidance on themes and customization

The project owner cares about possible theming/layout options and understands that different users may want different UI presentations.

This should remain a future concern, but phase 1 must stay grounded.

So:
- support for future theming should be designed in at the design-system level,
- alternate layout modes can be considered later,
- legacy-style themes and modern themes may eventually coexist,
- but phase 1 should not explode into many parallel visual systems.

First make one coherent, truthful, role-aware interface.

---

## 40. What the AI should do when memory gets thin or context is lost

If future context is limited, the AI should return to the following non-negotiable anchors from this document:

1. The old repo is archive/salvage, not canonical product truth.
2. The project now uses a clean restart.
3. There are three repos: archive, platform, VistA distro.
4. Start with control plane + VistA runtime + browser roll-and-scroll.
5. Build tenant admin slowly after runtime truth.
6. One slice at a time.
7. No proof, no claim.
8. VistA is source of truth where VistA already owns the data.
9. Platform DB exists only for platform/control-plane/integration concerns.
10. No SQLite, no in-memory persistence, no JSON pretending to be a database.
11. OpenAPI + AsyncAPI + schemas + capability manifests are required.
12. Docs must stay limited and structured.
13. Notion is a mirror, not the technical source of truth.
14. Port registry must be centralized.
15. Do not widen scope or resume giant module building.

---

## 41. Immediate next steps recommended at the end of the conversation

The final high-confidence recommendation at this point is:

### First prompt/stage
Bootstrap the three-repo structure:
- archive the old repo,
- create `vista-evolved-platform`,
- create `vista-evolved-vista-distro`,
- install governance, contracts, docs model, ownership metadata, persistence policy, and basic repo scaffolding,
- do not build product features yet,
- do not fetch upstreams yet in that bootstrap stage,
- do not build Docker yet in that bootstrap stage.

### Second prompt/stage
In the VistA distro repo:
- fetch/pin local WorldVistA upstreams,
- create custom Docker/runtime from local sources only,
- install runtime health/readiness/proof.

### Third prompt/stage
In the VistA distro or connected flow:
- prove authentic browser roll-and-scroll terminal against the custom runtime.

### Fourth prompt/stage
In the platform repo:
- implement minimal control-plane bootstrap contracts/manifests,
- then plan/build first tenant operational admin slices.

That is the current best path.

---

## 42. Closing instruction to future AI tools

If you are an AI tool using this document as context:

- do not revert to the old mode of uncontrolled feature generation,
- do not treat the archive repo as the final product,
- do not broaden into portal/telehealth/RCM/imaging/clinical UI before the foundations are real,
- do not replace VistA truth with convenience stores,
- do not create documentation sprawl,
- do not confuse control-plane admin with tenant operational admin,
- do not claim success without proof,
- do not skip human review stops,
- do not lose sight of the real starting point: **control plane + custom VistA runtime + authentic browser roll-and-scroll + slow tenant admin slices grounded in VistA truth**.

This project is intentionally moving from:

**AI-generated breadth**

to:

**proof-driven, human-reviewable, VistA-grounded depth**.

That is the central memory of this project.
