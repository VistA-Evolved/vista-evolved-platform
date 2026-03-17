# Governed build protocol

- **Contract-first:** APIs and events are defined in OpenAPI/AsyncAPI before implementation. Generated clients/server stubs are used; no ad-hoc HTTP calls when generators exist.
- **Config as code:** Ports, modules, tenants, capability packs are defined in config packages and validated by schemas.
- **Docs policy:** Only tutorials, how-to, reference, explanation, ADRs, runbooks. No sprawl.
- **Persistence:** Platform database only for control-plane and integration concerns. No SQLite; no in-memory for persistent state. VistA is source of truth where VistA owns the data.
- **Proof artifacts:** Verification and evidence go under `artifacts/`; not committed as canonical docs.

## Build flow for a bounded slice

Every bounded implementation slice follows this sequence:

1. **Artifact update.** Classify the change. Update required upstream planning artifacts and contracts in dependency order (per `contract-mutation-and-implementation-governance-protocol.md` §5).
2. **Implementation.** Write code that aligns to the updated artifacts. Do not introduce scope beyond what the artifacts declare.
3. **Self-audit.** Re-read all changed files. Check alignment against governing artifacts. Fix inconsistencies within scope. If the slice touches user-visible UI, bring it up in the browser or terminal when feasible and inspect for developer leakage, placeholder text, or broken states.
4. **Proof.** Run validation (schema checks, lint, type checks, existing governance gates). Produce runtime proof where applicable. Produce the task report.
5. **Commit and push.** If the slice is bounded, passes all validation and self-audit, has no unresolved stop rules, and does not cross into ADR / major governance / architecture territory, commit and push in the same task. Stop for explicit human approval only when: the user explicitly asked for a pause, a stop rule remains unresolved, the change is materially risky, or the change crosses into ADR / major governance / architecture territory.
6. **Report.** Produce the task report with all required sections (per AGENTS.md §5). Do not start the next slice until the human explicitly instructs.
