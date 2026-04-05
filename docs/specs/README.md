# VistA Evolved — Product Specification Library

> **This folder contains the authoritative product specifications for VistA Evolved.**
> All AI coding agents and developers MUST read the relevant spec before building any workspace or page.
> These documents were converted from the original planning library (62 Word documents) on April 4, 2026.

---

## How to Use This Library

1. **Start here:** Read `0.-master-delivery-plan-&-team-handoff-guide.md` — it maps every workspace to its artifacts and defines the build sequence.
2. **For any workspace:** Find the matching Volume (domain spec) + Wireframe (WF layout spec) + the Screen Contracts in Doc 2.
3. **For vocabulary:** ALWAYS consult `17.-product-vocabulary-master-sheet.md` — 134 mapped terms. **Never expose VistA Column A terms to end users. Always use Column C (Modern Product Term).**
4. **For design tokens and components:** Read `30.-design-system-&-component-library.md` — the unified design system.
5. **For RPC wrappers:** Read `48.-custom-wrapper-rpc-master-specification.md` — 332 ZVE wrapper RPCs across 15 domains.
6. **For API architecture:** Read `49.-api-gateway-&-rpc-broker-adapter-specification.md` — the three-tier integration layer.

---

## Document Map

### Foundation Documents

| # | Document | Purpose |
|---|----------|---------|
| 0 | [Master Delivery Plan](0.-master-delivery-plan-&-team-handoff-guide.md) | **START HERE.** Complete build sequence, artifact inventory, team instructions |
| 1 | [Module-to-Package Mapping](1.-module-to-package-family-mapping-matrix-v1.md) | All 11 workspaces mapped to VistA packages, RPC coverage, wave assignments |
| 2 | [Page Inventory + Screen Contracts v1](2.-page-inventory-matrix-+-screen-contracts-v1.md) | Field-by-field specs for Admin (12 pages) and Scheduling (20 pages) |
| 3 | [Terminal/RPC Coverage Ledger](3.-terminal-option-inventory,-cprs-dependency-map,-rpc-coverage-ledger.md) | Terminal option inventory, CPRS dependency map, RPC gap analysis |

### Domain Volumes (Detailed Workspace Specs)

| # | Document | Workspace |
|---|----------|-----------|
| 3.1 | [Volume 1: Admin/Provider Setup](3.1-volume-1_-admin-user_provider-setup.md) | Admin & Security |
| 4 | [Volume 2: Scheduling](4.-volume-2_-scheduling-workspace.md) | Scheduling |
| 5 | [Volume 3: Patients & Registration](5.-volume-3_-patient-search,-registration-&-chart-foundation.md) | Patients & Registration |
| 6 | [Volume 4: Clinical Workspace](6.-volume-4_-clinical-workspace.md) | Clinical |
| 6.1 | [Volume 4 Supplement](6.1-volume-4-supplement.md) | Clinical (extended) |
| 6.2 | [Volume 4 Supplement B: Medicine](6.2-volume-4-supplement-b_-medicine-procedures.md) | Clinical (medicine procedures) |
| 7 | [Volume 5: Pharmacy (Outpatient)](7.-volume-5_-pharmacy-(outpatient).md) | Pharmacy |
| 7.1 | [Volume 5B: Inpatient Pharmacy](7.1-volume-5b_-inpatient-pharmacy.md) | Pharmacy (inpatient) |
| 7.2 | [Volume 5C: BCMA](7.2-volume-5c_-bar-code-medication-administration-(bcma).md) | Pharmacy (BCMA) |
| 7.3 | [Volume 5D: Controlled Substances](7.3-volume-5d_-controlled-substances-+-drug-accountability_inventory.md) | Pharmacy (controlled substances) |
| 7.4 | [Volume 5E: Pharmacy Config](7.4-volume-5e_-pharmacy-configuration.md) | Pharmacy (configuration) |
| 7.5 | [Volume 5F: CMOP/ECME](7.5-volume-5f_-cmop-+-ecme-+-ar_ws.md) | Pharmacy (CMOP/ECME) |
| 8 | [Volume 6: Laboratory](8.-volume-6_-laboratory.md) | Laboratory |
| 8.1 | [Volume 6 Supplement: Blood Bank](8.1-volume-6-supplement_-blood-bank-+-anatomic-pathology.md) | Laboratory (blood bank + pathology) |
| 9 | [Volume 7: Radiology & Imaging](9.-volume-7_-radiology-&-imaging.md) | Radiology |
| 10 | [Volume 8: Billing & Revenue](10.-volume-8_-billing-and-revenue.md) | Billing |
| 10.1 | [Volume 8 Supplement: AR](10.1-volume-8-supplement_-accounts-receivable.md) | Billing (accounts receivable) |
| 11 | [Volume 9: Supply & Inventory](11.-volume-9_-supply-and-inventory.md) | Supply |
| 12 | [Volume 10: Interfaces & Devices](12.-volume-10_-interfaces-and-devices.md) | Interfaces |
| 13 | [Volume 11: Analytics & Oversight](13.-volume-11_-analytics-and-oversight.md) | Analytics |
| 15 | [Volume 12: Surgery](15.-volume-12_-surgery.md) | Surgery |
| 25 | [Volume 13: Dietetics & Nutrition](25.-volume-13_-dietetics-_-nutrition.md) | Dietetics |
| 26 | [Volume 14: Mental Health](26.-volume-14_-mental-health.md) | Mental Health |
| 27 | [Volume 15: Nursing](27.-volume-15_-nursing.md) | Nursing |
| 28 | [Volume 16: Prosthetics & DME](28.-volume-16_-prosthetics-_-dme.md) | Prosthetics |
| 29 | [Volume 17: Specialty Modules](29.-vol-17_-specialty-modules.md) | Specialties |

### Wireframe Specifications (UI Layout + Interaction)

| # | Document | Workspace |
|---|----------|-----------|
| 31 | [WF-01: App Shell + Global](31.-wf-01_-app-shell-+-global-components.md) | Shared shell, nav, patient banner |
| 32 | [WF-02: Clinical](32.-wireframe-wf-02_-clinical-workspace.md) | Clinical workspace layout |
| 33 | [WF-03: Pharmacy](33.-wf-03_-pharmacy-workspace.md) | Pharmacy workspace layout |
| 34 | [WF-04: Laboratory](34.-wf-04_-laboratory-workspace.md) | Lab workspace layout |
| 35 | [WF-05: Patients](35.-wf-05_-patients-_-registration-workspace.md) | Patient/registration layout |
| 36 | [WF-06: Scheduling](36.-wf-06_-scheduling-workspace.md) | Scheduling workspace layout |
| 37 | [WF-07: Radiology](37.-wf-07_-radiology-_-imaging-workspace.md) | Radiology workspace layout |
| 38 | [WF-08: Billing](38.-wf-08_-billing-_-revenue-workspace.md) | Billing workspace layout |
| 39 | [WF-09: Supply](39.-wf-09_-supply-_-inventory-workspace.md) | Supply workspace layout |
| 40 | [WF-10: Surgery](40.-wf-10_-surgery-workspace.md) | Surgery workspace layout |
| 41 | [WF-11: Admin & Security](41.-wf-11_-admin-_-security-workspace.md) | Admin workspace layout |
| 42 | [WF-12: Interfaces](42.-wf-12_-interfaces-_-devices-workspace.md) | Interfaces workspace layout |
| 43 | [WF-13: Analytics](43.-wf-13_-analytics-_-oversight-workspace.md) | Analytics workspace layout |
| 44 | [WF-14: Prosthetics](44.-wf-14_-prosthetics-_-dme-workspace.md) | Prosthetics workspace layout |
| 45 | [WF-15: Specialty Modules](45.-wf-15_-specialty-clinical-modules.md) | Specialty modules layout |
| 46 | [WF-16: Social Work](46.-wf-16_-social-work.md) | Social work workspace layout |

### Cross-Cutting Specifications

| # | Document | Purpose |
|---|----------|---------|
| 14 | [Gap Analysis](14.-gap-analysis-&-full-package-audit.md) | Full package audit and gap identification |
| 16 | [Tenant Profile Matrix](16.-tenant-_-product-profile-matrix.md) | Product profiles per tenant type |
| 17 | [**Vocabulary Master Sheet**](17.-product-vocabulary-master-sheet.md) | **134 VistA-to-modern term mappings — THE translation authority** |
| 18 | [I18n Framework](18.-internationalization-framework.md) | Internationalization architecture |
| 19 | [Billing Adapter Architecture](19.-billing-adapter-_-overlay-architecture.md) | Non-VA billing overlay |
| 20 | [Configuration vs Usage Matrix](20.-configuration-vs-usage-matrix.md) | What is config vs runtime |
| 21 | [Security/Permission Matrix](21.-security-_-permission-translation-matrix.md) | VistA keys to product roles |
| 22 | [Audit/Irreversibility Matrix](22.-audit-_-irreversibility-matrix.md) | What actions are audited/irreversible |
| 23 | [Device Integration Catalog](23.-device-_-instrument-integration-catalog.md) | Medical device integration |
| 24 | [FHIR R4 API Architecture](24.-fhir-r4-api-architecture.md) | FHIR interoperability layer |
| 24.1 | [FHIR Comparison](24.1-fhir-api-architecture-(compare).md) | FHIR architecture comparison |
| 30 | [**Design System**](30.-design-system-&-component-library.md) | **Tokens, components, accessibility, responsive rules** |

### Engineering Specifications

| # | Document | Purpose |
|---|----------|---------|
| 47 | [Acceptance Criteria](47.-acceptance-criteria-validation-checklists.md) | Validation checklists for all workspaces |
| 48 | [**RPC Wrapper Catalog**](48.-custom-wrapper-rpc-master-specification.md) | **332 ZVE wrapper RPCs — M developer reference** |
| 49 | [**API Gateway Spec**](49.-api-gateway-&-rpc-broker-adapter-specification.md) | **Three-tier integration architecture** |
| 50 | [Deployment Procedures](50.-step-by-step-deployment-and-setup-procedures.md) | Step-by-step setup and deployment |

---

## Build Order (from Master Delivery Plan)

1. **Phase 1 (Wave 1):** Admin/Security workspace + Design System + RPC Broker Adapter
2. **Phase 2 (Wave 1):** Scheduling workspace (strongest existing RPC coverage)
3. **Phase 3 (Wave 1-2):** Patients & Registration + Clinical foundation
4. **Phase 4+ (Wave 2-3):** Pharmacy, Lab, Radiology
5. **Phase 5+ (Wave 3-4):** Billing, Supply, Surgery, Interfaces, Analytics, Specialties
