# Organization, Facility, Network, and Service Model — VistA Evolved

> **Status:** Accepted conceptual model.
> **Date:** 2026-03-16.
> **Scope:** Canonical entity model for enterprise/business topology across VistA Evolved.
> **Owner:** vista-evolved-platform (this repo). VistA-native entity truth remains in the distro repo.
> **Parent:** `docs/explanation/global-system-architecture-spec.md`, Section 8 and Section 20 item 1.

---

## 1. Document purpose and status

### What this document is

This is the **authoritative conceptual model** for VistA Evolved's organizational, facility, network, and service topology. It defines canonical terms, entity relationships, ownership boundaries, and structural constraints that govern all future schemas, manifests, workspace maps, and screen contracts.

This is the first follow-on specification to the global system architecture backbone. It elaborates Section 8 (Enterprise and Business Topology) of `global-system-architecture-spec.md` and fulfills Section 20 item 1 of that document.

### What this document is not

- Not a database schema specification.
- Not a FHIR resource mapping.
- Not an API endpoint definition.
- Not a screen or UI specification.
- Not authorization to begin schema implementation or UI buildout.
- Not a replacement for VistA-native organizational truth.

### What this document resolves

- Canonical vocabulary for enterprise topology entities.
- Clear distinction between hierarchical containment and network/affiliation relationships.
- Explicit boundaries: what VistA owns, what platform governs, what is shared or derived.
- How the conceptual model supports topologies from single clinic through multi-hospital enterprise.
- Tenant vs legal entity vs organization vs facility — no longer ambiguous.

### What this document defers

- Relational or document schema definitions (future schema spec).
- FHIR Organization, Location, Practitioner, PractitionerRole resource mappings (future interop spec).
- API endpoint design (future contract work in `packages/contracts/openapi/`).
- Screen inventory and workspace composition (future information architecture and screen contract specs).
- Detailed payer registry structure (future country/payer readiness spec).
- Pack lifecycle governance (next artifact: pack and adapter architecture governance).

---

## 2. Relationship to the global system architecture spec

This document is governed by and must not contradict `docs/explanation/global-system-architecture-spec.md`.

| Architecture backbone section | How this document relates |
|-------------------------------|--------------------------|
| Section 6: One-truth-bearing runtime | This model respects VistA as clinical/operational SoT. Platform entities are governance/config only. |
| Section 8: Enterprise and business topology | This document is the detailed elaboration of Section 8. |
| Section 9: Country/legal-market/payer variation | This model defines the organizational context in which country/payer variation applies. |
| Section 10: Pack taxonomy | This model defines entities that packs attach to (facilities, specialties, legal markets). |
| Section 12: Workspace separation | This model defines the entity context that workspaces operate within. |
| Section 13: Control plane vs tenant admin | This model defines what control plane provisions and what tenant admin configures. |
| Section 19: Out-of-scope | This model does not authorize implementation. |
| Section 20, item 1 | This document fulfills that artifact slot. |

---

## 3. Modeling goals

The conceptual model must support all of the following deployment scenarios without requiring schema forks, repo forks, or architectural deviation:

1. **Single clinic** — one legal entity, one facility, a handful of practitioners.
2. **Network of clinics** — one legal entity (or small group), 5–50 outpatient facilities under shared governance.
3. **Single hospital** — one facility with inpatient wards, outpatient clinics, ancillary departments, and shared services.
4. **Multi-hospital enterprise** — one enterprise owning multiple hospitals and ambulatory sites, with shared formularies, credentialing, and reporting.
5. **Mixed hospital + clinic network** — hospitals and clinics under one umbrella, possibly spanning multiple legal entities.
6. **Shared-service enterprises** — a central lab, radiology center, or pharmacy serving multiple otherwise-independent facilities.
7. **Future multi-country variation** — an enterprise operating in more than one legal market, without per-country forks of the entity model.

The model must be detailed enough to constrain later schemas while remaining technology-neutral at this stage.

---

## 4. Modeling anti-goals and forbidden drift

| Anti-goal | Why it is forbidden |
|-----------|---------------------|
| Collapsing everything into one flat "facility" noun | Real-world healthcare has legal entities, organizations, facilities, locations, departments, and wards. Flattening loses critical governance and clinical distinctions. |
| Treating tenant, legal entity, organization, and facility as synonyms | They are structurally different concepts with different ownership, lifecycle, and access implications. Conflating them prevents multi-facility tenants and multi-entity enterprises. |
| Forcing all relationships into a pure tree | Affiliations, referral networks, shared services, practitioner cross-site privileges, and payer relationships are graph structures. Forcing them into strict parent-child trees creates false containment and breaks real-world modeling. |
| Moving VistA-owned truth into platform for convenience | VistA Files 4, 44, 200, 40.8, 42, and 42.4 own clinical organizational truth. Platform may reference or map these but must not replace them as system of record. |
| Making schema-level decisions in this document | This document defines the conceptual model. Schema decisions (column types, foreign keys, indexes, JSON shapes) are deferred to a future schema spec. |
| Overfitting to one country or one specialty | The model must accommodate US, Philippines, Korea, and future markets. It must not bake in assumptions that only work for one country's regulatory structure or one specialty's workflow. |
| Inventing platform-side clinical role truth | VistA person classes, keys, and menu assignments are VistA-owned. Platform manages identity bridge and platform-level access; it does not redefine clinical authorization. |

---

## 5. Canonical vocabulary and definitions

Each term below is the canonical definition for VistA Evolved. Future schemas, APIs, manifests, and UI must use these terms consistently.

### 5.1 Governance and containment entities

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Tenant** | The top-level platform isolation boundary. A tenant is a single customer deployment with its own data partition, configuration, entitlements, and administrative scope. One tenant maps to one or more VistA instances and one platform data partition. | Not synonymous with legal entity, organization, or facility. A tenant is a platform concept; it does not exist in VistA. | Platform |
| **Legal entity** | A legally incorporated body (corporation, partnership, government agency, sole proprietor) that holds licenses, contracts, and regulatory obligations. A legal entity may own one or more organizations, facilities, or both. | Not the same as tenant (a tenant may contain multiple legal entities in a complex enterprise). Not the same as organization (a legal entity is a legal/regulatory concept; an organization is an operational concept). | Platform (governance) |
| **Enterprise** | A grouping of legal entities and/or organizations under common ultimate ownership or governance. An enterprise represents the highest administrative umbrella in a complex health system. | Not a required entity for simple deployments. A single-clinic tenant has no separate enterprise layer. Not a VistA concept. | Platform (governance) |
| **Organization** | An operational unit within a legal entity that manages a coherent set of facilities or services. Examples: a hospital system division, a regional clinic group, a specialty practice group. | Not the same as legal entity (an organization is operational; a legal entity is legal). Not the same as facility (an organization may contain multiple facilities). | Platform (governance), may map to VistA Division |
| **Network** | A non-ownership affiliation among facilities, organizations, or legal entities for purposes such as referral, shared contracting, population health, or coordinated care. Networks are graph relationships, not containment hierarchies. | Not a parent-child relationship. Not an organization (membership is affiliative, not hierarchical). | Platform (governance) |

### 5.2 Physical and logical site entities

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Facility** | A physical site or campus where healthcare services are delivered. Has a physical address, regulatory licenses, and operational identity. Maps to VistA Institution (File 4) where VistA owns the clinical instance. | Not a location (a facility contains locations). Not an organization (a facility is a site; an organization is an operational grouping of sites). | Shared: VistA (File 4, clinical) / Platform (governance, provisioning) |
| **Location** | A distinct area within a facility: a building, floor, wing, or named area. Locations contain departments. | Not a facility (a location is inside a facility). Not a department (a location is physical; a department is organizational). | Shared: VistA (File 44 subtypes) / Platform (config) |
| **Department** | An organizational unit within a location that provides a defined scope of clinical or administrative services. Departments may contain clinics (outpatient) or wards (inpatient). | Not a location (departments exist within locations but are organizational, not purely physical). Not a specialty (a department may serve multiple specialties). | Shared: VistA (File 44 subtypes) / Platform (config) |
| **Clinic** | An outpatient scheduling and delivery unit, typically within a department. Maps to VistA Hospital Location (File 44) where the location type is clinic. | Not a facility (a clinic is inside a facility). Not a ward (clinics are outpatient; wards are inpatient). | VistA (File 44) |
| **Ward** | An inpatient care unit with beds, typically within a department. Maps to VistA Ward Location (File 42). | Not a clinic (wards are inpatient; clinics are outpatient). Not a bed (a ward contains beds). | VistA (File 42) |
| **Bed** | An individual patient care station within a ward. Maps to VistA Bed Status (File 42.4). | Not a ward (a bed is inside a ward). | VistA (File 42.4) |

### 5.3 Service and specialty entities

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Service line** | A cross-location organizational grouping of related clinical or operational services (e.g., "surgical services," "women's health," "behavioral health"). A service line may span multiple departments and facilities. | Not a department (service lines are enterprise-scoped; departments are location-scoped). Not a specialty (a service line groups specialties). | Platform (governance), may map to VistA Service/Section (File 40.8) |
| **Specialty** | A clinical discipline (e.g., cardiology, orthopedics, psychiatry, family medicine) that defines scope of practice, credentialing requirements, and clinical content. Specialties attach to practitioners, departments, and content packs. | Not a department (a specialty is a clinical discipline; a department is an organizational unit). Not a service line (a specialty is more specific). | Shared: VistA (person class) / Platform (content packs, credentialing config) |

### 5.4 People and role entities

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Practitioner** | A person who provides clinical or administrative services within the system. Has both a VistA identity (File 200 — New Person) and a platform identity (IdP/platform user record). | Not the same as practitioner role (a practitioner is a person; a role is an assignment). | Shared: VistA (File 200) / Platform (IdP, identity bridge) |
| **Practitioner role** | A specific function a practitioner performs at a specific scope (facility, department, service line, specialty). Includes clinical roles (attending physician, staff nurse, consulting pharmacist) and administrative roles (department chief, medical director). Maps to VistA person classes, keys, and menu assignments at the VistA level. | Not the same as practitioner (a role is scoped and assignable; a practitioner is a person). Not a generic platform "user role" (practitioner role is clinically and operationally meaningful). | Shared: VistA (person class, keys, menus) / Platform (role mapping, access bridge) |
| **Team** | A group of practitioners assembled for a specific care-delivery or operational purpose (e.g., primary care team, surgical team, rapid response team). Teams are dynamic and may cross department or facility boundaries. | Not a department (teams are purpose-assembled; departments are standing organizational units). Not an org-chart position. | Shared: VistA (OE/RR teams where applicable) / Platform (team config) |
| **Privilege scope** | The set of facilities, locations, departments, and specialties where a practitioner is authorized to perform a specific role. Privilege scope may be site-specific or cross-facility within an enterprise. | Not a role itself (privilege scope constrains where a role applies). | Shared: VistA (keys, person class) / Platform (enterprise credentialing config) |

### 5.5 Patient and coverage entities

| Term | Definition | What it is NOT | Primary owner |
|------|-----------|----------------|---------------|
| **Patient** | A person receiving or eligible to receive healthcare services. Owns a clinical record in VistA (Patient file, DFN). | Not a platform concept as system of record. Platform may hold scheduling/portal identity references but VistA owns the canonical patient record. | VistA |
| **Patient attribution / care context** | The set of relationships that connect a patient to facilities, clinics, care teams, payers, and episodes at a point in time. Determines where and by whom the patient is actively receiving care. | Not a single foreign key. Attribution is multi-dimensional and time-varying. | Shared: VistA (encounters, visits, admissions) / Platform (attribution config) |
| **Payer** | An entity that pays for or reimburses healthcare services: insurance company, government program, employer health plan, or self-pay. | Not the same as sponsor or employer (payers are the financial entity; sponsors may select or fund coverage). | Shared: VistA (IB/AR where clinical billing) / Platform (payer registry metadata, integration config) |
| **Sponsor / employer / program** | An entity that selects, funds, or administers coverage on behalf of patients: employer group, government program (VA, PhilHealth, Medicaid), military branch, or union. | Not the same as payer (sponsors arrange coverage; payers adjudicate and pay claims). | Shared: VistA (where applicable) / Platform (registry, eligibility config) |
| **Affiliation** | A non-ownership, non-containment relationship between entities: referral agreements, shared-service contracts, network memberships, teaching affiliations, payer network participation. | Not a parent-child hierarchy. Affiliations are edges in a graph, not positions in a tree. | Platform (governance, config) |

---

## 6. Structural relationships: hierarchy vs network

### 6.1 Hierarchical containment model

These relationships form strict parent → child containment. Each child belongs to exactly one parent in the hierarchy.

```
Enterprise (optional top-level grouping)
  └── Legal Entity
        └── Organization
              └── Facility
                    └── Location
                          ├── Department
                          │     ├── Clinic (outpatient)
                          │     └── Ward (inpatient)
                          │           └── Bed
                          └── (other location subdivisions)
```

**Containment rules:**

- A legal entity belongs to at most one enterprise (or stands alone).
- An organization belongs to exactly one legal entity.
- A facility belongs to exactly one organization.
- A location belongs to exactly one facility.
- A department belongs to exactly one location.
- A clinic belongs to exactly one department.
- A ward belongs to exactly one department.
- A bed belongs to exactly one ward.

**Tenant overlay:** A tenant may contain one or more legal entities. The tenant boundary is the platform isolation unit; the legal entity hierarchy operates within it.

### 6.2 Non-hierarchical network model

These relationships are **not** containment. They connect entities that collaborate, share, affiliate, or have contractual relationships without one owning the other.

| Relationship type | Participants | Nature | Example |
|-------------------|-------------|--------|---------|
| Referral network | Facilities ↔ Facilities | Affiliative | Regional referral agreement for cardiac surgery |
| Shared service | Facility → Shared service facility | Contractual | Central lab processes specimens for 12 clinics |
| Payer network | Payer ↔ Facilities | Contractual | Blue Cross preferred provider network |
| Teaching affiliation | Hospital ↔ University | Affiliative | Medical school clinical rotation program |
| Practitioner cross-site privilege | Practitioner → multiple Facilities | Credentialing | Surgeon operates at 3 hospitals in enterprise |
| Care team membership | Practitioners ↔ Team | Purpose-assembled | Rapid response team includes members from multiple departments |
| Enterprise program | Enterprise → Facilities | Governance | Enterprise-wide sepsis protocol |
| Population health | Network ↔ Patient cohort | Analytic | ACO shared savings population |

### 6.3 Hierarchy vs network comparison

| Aspect | Hierarchy (containment) | Network (affiliation) |
|--------|------------------------|-----------------------|
| Relationship type | Parent → child | Peer ↔ peer or many ↔ many |
| Cardinality | Child has exactly one parent | Entity may have many affiliations |
| Lifecycle | Created/removed with parent awareness | Added/removed independently |
| Access implications | Inherits parent scope | Must be explicitly granted |
| Data model shape | Tree (adjacency list, nested set, closure table) | Graph (edge table, adjacency matrix) |
| Examples | Org → Facility → Location → Department | Referral network, payer participation, cross-privilege |

**Architectural position:** Future schemas must support both models. Do not force affiliative relationships into fake parent-child trees. Do not force containment relationships into loose edge tables.

---

## 7. Tenant, legal entity, organization, facility, location

### 7.1 What is a tenant?

A **tenant** is the top-level platform isolation boundary. It is a platform concept that does not exist in VistA.

| Property | Detail |
|----------|--------|
| Isolation | Each tenant has its own data partition, configuration, entitlements, and administrative scope |
| VistA binding | A tenant maps to one or more VistA instances (one per site or shared) |
| Multi-entity | One tenant may contain multiple legal entities, organizations, and facilities |
| Provisioning | Created by control-plane operators during onboarding |
| Admin scope | Tenant admins can configure entities within their tenant but not across tenants |

### 7.2 How does tenant differ from legal entity?

| Dimension | Tenant | Legal entity |
|-----------|--------|-------------|
| Origin | Platform concept | Real-world legal/regulatory concept |
| Exists in VistA | No | No (VistA has Institution/File 4, not "legal entity") |
| Multiplicity | One tenant per customer deployment | One tenant may contain 1–N legal entities |
| Purpose | Isolation, access, billing, data partition | Licensing, contracts, regulatory compliance |
| Created by | Control-plane operator | Legal/regulatory filing; registered in platform by control-plane or tenant admin |

### 7.3 How does legal entity differ from organization?

| Dimension | Legal entity | Organization |
|-----------|-------------|-------------|
| Nature | Legal/regulatory body with licenses and contracts | Operational grouping managing facilities and services |
| Example | "Acme Health System, Inc." (the corporation) | "Acme Hospital Division" or "Acme Primary Care Group" (operational units within the corporation) |
| Cardinality | One legal entity may contain 1–N organizations | One organization belongs to exactly one legal entity |
| Purpose | Regulatory compliance, contracting, liability | Operational management, service delivery grouping |

### 7.4 How does organization differ from facility?

| Dimension | Organization | Facility |
|-----------|-------------|----------|
| Nature | Operational grouping | Physical site or campus |
| Has a physical address | Not necessarily (may be an administrative umbrella) | Yes, always |
| Contains | Facilities | Locations, departments, clinics, wards |
| VistA mapping | May correspond to VistA Division concept | Maps to VistA Institution (File 4) |
| Example | "Acme Ambulatory Care Group" | "Acme Downtown Clinic" at 123 Main St |

### 7.5 How does facility differ from location?

| Dimension | Facility | Location |
|-----------|---------|----------|
| Scope | Entire site or campus | Area within a facility (building, floor, wing) |
| Has a separate postal address | Yes | Not necessarily (shares facility address) |
| Contains | Locations | Departments |
| VistA mapping | File 4 (Institution) | File 44 subtypes (where applicable) |
| Example | "Acme General Hospital" | "Building A, 3rd Floor, West Wing" |

### 7.6 Provisioning implications

1. **Control-plane onboarding** creates the tenant and registers its legal-market selection.
2. **Tenant setup** (by control-plane operator or tenant admin, depending on complexity) registers legal entities, organizations, and facilities within the tenant.
3. **Facility binding** connects each platform facility reference to its corresponding VistA Institution (File 4) and VistA instance endpoint.
4. **Location/department/ward/bed setup** may be driven by VistA data (read from File 44, File 42) and supplemented by platform-level metadata where VistA does not carry it.
5. **UI for this workflow must wait** until this conceptual model is accepted and stable.

---

## 8. Care-delivery structure

### 8.1 Department, service line, specialty, clinic, ward, bed

These entities describe how care is organized and delivered within a facility. They serve different purposes and must not be conflated.

| Entity | Scope | Nature | Contains | VistA analog |
|--------|-------|--------|----------|-------------|
| Department | Location-scoped | Organizational unit providing defined services | Clinics and/or wards | File 44 subtypes |
| Service line | Enterprise or facility-scoped | Cross-location grouping of related services | (References departments; does not contain them) | File 40.8 (Service/Section) |
| Specialty | Cross-cutting | Clinical discipline defining scope of practice | (Attached to practitioners, departments, content packs) | Person class, specialty field |
| Clinic | Department-scoped | Outpatient scheduling and delivery unit | Appointment slots, clinic teams | File 44 (type = clinic) |
| Ward | Department-scoped | Inpatient care unit | Beds | File 42 |
| Bed | Ward-scoped | Individual patient care station | — | File 42.4 |

### 8.2 Inpatient vs outpatient context

| Dimension | Outpatient | Inpatient |
|-----------|-----------|-----------|
| Care unit | Clinic | Ward |
| Scheduling | Appointment-based | Admission-based |
| Patient state | Visit (comes and goes) | Admitted (occupies bed) |
| Length of stay | Minutes to hours | Hours to weeks |
| VistA tracking | Scheduling (File 44 appointments) | ADT (admission/discharge/transfer) |

Some departments (e.g., Emergency) may operate in hybrid inpatient/outpatient modes. The model must not force a binary.

### 8.3 Cross-facility shared services

A shared service is a department or functional unit at one facility that provides services to patients or specimens from other facilities.

| Shared service pattern | Example | Model representation |
|------------------------|---------|---------------------|
| Central lab | One lab processes specimens for 12 clinics | Lab is a department at facility A. Facilities B–M have affiliative service relationships with facility A's lab. |
| Regional radiology | One imaging center serves a hospital + 5 clinics | Radiology department at facility A has shared-service agreements with facilities B–F. |
| Centralized pharmacy | One pharmacy fills prescriptions for a clinic network | Pharmacy department at facility A. Courier/delivery relationships with facilities B–N. |
| Shared credentialing | One credentialing office serves the entire enterprise | Enterprise-level service not tied to a single facility. |

Shared services are modeled as **affiliative relationships** (Section 6.2), not by moving the department into a fake parent organization.

---

## 9. Practitioner, role, affiliation model

### 9.1 Practitioner vs practitioner role

A **practitioner** is a person. A **practitioner role** is a function that person performs at a defined scope.

| Dimension | Practitioner | Practitioner role |
|-----------|-------------|-------------------|
| What it is | A human being with credentials | A scoped assignment: what the person does, where, with what authority |
| Multiplicity | One person | One person may hold many roles across sites and specialties |
| Examples | Dr. Kim (NPI: 1234567890) | Attending cardiologist at Acme Hospital; consulting physician at City Clinic |
| VistA identity | File 200 (New Person) | Person class, keys, menu assignments in File 200 subfiles |
| Platform identity | IdP user record, platform user profile | Role mapping, access assignment, privilege scope |

### 9.2 Employment vs affiliation

| Dimension | Employment | Affiliation |
|-----------|-----------|-------------|
| Nature | Formal employment relationship with a legal entity or organization | Credentialing, privileges, or contractual relationship without employment |
| Duration | Ongoing (until resignation/termination) | May be episodic, renewed, or per-contract |
| Examples | Dr. Kim is employed by Acme Health System | Dr. Kim has surgical privileges at City Hospital (not employed there) |
| Model | Containment: practitioner → organization/legal entity | Graph: practitioner ↔ facility (privilege grant) |

### 9.3 Site-specific vs cross-facility privileges

In a multi-facility enterprise, a practitioner may:

- Be employed at one facility but hold privileges at several.
- Have different roles at different sites (attending at one, consultant at another).
- Be subject to different credentialing rules at each site (especially across legal entities or jurisdictions).

**Architectural position:** The model must support per-site privilege scope. A practitioner's authorization at facility A does not automatically grant authorization at facility B, even within the same tenant. Cross-site privileges require explicit grants.

### 9.4 Care teams vs static org chart roles

| Dimension | Org chart role | Care team |
|-----------|---------------|-----------|
| Formation | Standing position in department hierarchy | Assembled for a specific care purpose |
| Duration | Persistent until reorganized | May be temporary (shift, episode, project) |
| Scope | Department or service line | May cross departments and facilities |
| Examples | Chief of Medicine, Head Nurse of Ward 3A | Patient 46's primary care team, Trauma Team Alpha |
| Membership | One person per position (typically) | Multiple members with defined roles |

### 9.5 Coexistence with VistA File 200 / person class / keys / menus

This model does **not** replace VistA's user/provider management.

| Concern | VistA owns | Platform manages | Bridge |
|---------|-----------|-----------------|--------|
| Clinical user identity | File 200 (DUZ, name, credentials) | IdP user record, SSO token | Identity bridge maps platform user ↔ VistA DUZ |
| Person class | Person class field in File 200 | (Read-only reference) | Platform reads VistA person class; does not write it |
| Security keys | XUSEC keys in VistA | (Read-only reference) | Platform reads VistA keys for role inference |
| Menu assignments | Menu trees in VistA Kernel | (Not managed by platform) | Terminal session uses VistA menus directly |
| Enterprise credentialing | — | Cross-facility privilege config | Platform resolves which facilities a practitioner may access; VistA enforces site-level keys |

---

## 10. Patient and care context relationships

### 10.1 Conceptual relationship map

A patient can simultaneously be related to:

| Related entity | Relationship | Cardinality | Example |
|----------------|-------------|-------------|---------|
| Tenant | Care delivery context | 1 (primary) | Patient 46 is cared for within the Acme Health tenant |
| Facility | Registration / encounter | 1–N | Patient 46 has been seen at Acme Downtown Clinic and Acme General Hospital |
| Clinic | Outpatient scheduling | 0–N | Patient 46 has upcoming appointment at Cardiology Clinic |
| Ward / bed | Inpatient admission | 0–1 at a time | Patient 46 is admitted to Ward 3A, Bed 12 |
| Care team | Care assignment | 0–N | Patient 46's primary care team includes Dr. Kim, RN Garcia, PharmD Lee |
| Payer / program | Coverage | 1–N | Patient 46 has Blue Cross primary, Medicaid secondary |
| Episode / encounter | Service context | 0–N per time period | Patient 46's current surgical episode spans pre-op clinic visits + admission + post-op follow-up |
| Practitioner | Care relationship | 0–N | Patient 46's PCP is Dr. Kim; consulting cardiologist is Dr. Park |

### 10.2 What VistA owns vs what platform may reference

| Data | Owner | Platform role |
|------|-------|--------------|
| Patient demographics | VistA (Patient file) | Read-only reference; portal identity bridge |
| Encounters / visits | VistA (Visit file, PCE) | Read-only reference for analytics, attribution |
| Admissions | VistA (ADT) | Read-only reference for bed management display |
| Appointments | VistA (Scheduling, File 44) | Read-only reference; scheduling adapter |
| Problem list, allergies, meds | VistA | Not referenced by organizational model |
| Patient-to-payer linkage | VistA (Insurance fields) | Read-only reference; payer registry metadata in platform |

### 10.3 Scope boundary

This section defines relationships conceptually. Encounter schemas, attribution algorithms, and care-context resolution logic are deferred to future specifications. No encounter or episode schema is defined here.

---

## 11. Payer, program, employer, sponsor relationships

### 11.1 Conceptual relationships

```
Patient
  ├── covered by → Payer (1–N)
  │     └── through → Plan/Product
  │           └── funded/arranged by → Sponsor / Employer / Program
  └── eligible for → Government Program (0–N)

Facility
  ├── contracted with → Payer (0–N)
  │     └── participates in → Payer Network (0–N)
  └── licensed by → Regulatory body (per jurisdiction)

Enterprise / Network
  └── negotiates contracts with → Payer (0–N)
```

### 11.2 Key distinctions

| Concept | Definition | Example |
|---------|-----------|---------|
| Payer | Adjudicates and pays claims | Blue Cross Blue Shield, PhilHealth, Medicare |
| Plan / product | Specific coverage product offered by a payer | BCBS Gold PPO, PhilHealth Employed Program |
| Sponsor / employer | Selects or funds coverage for a group of patients | Acme Corporation (employer), US Department of Veterans Affairs (government sponsor) |
| Program | A government or institutional initiative that provides or mandates coverage | Medicaid, PhilHealth Universal, TRICARE |

### 11.3 Why payer readiness is not country readiness

A country may be:
- **Language-ready** (strings translated) but not payer-ready.
- **Regulatory-ready** (compliance packs active) but missing payer integrations.
- **Payer-ready for some payers** but not all within that country.

Payer readiness is tracked per-payer, not as a blanket country attribute. The country/payer readiness registry spec (global architecture Section 20, item 4) will define the tracking dimensions.

### 11.4 Scope boundary

This section defines payer/sponsor/program relationships conceptually. Detailed payer registry schema, eligibility-check API contracts, claim-format mappings, and integration-mode configuration are deferred to the country/payer readiness spec and RCM architecture.

---

## 12. Topology scenarios

The following table demonstrates how the conceptual model handles progressively complex enterprise topologies.

### Scenario 1: Single clinic

| Dimension | Detail |
|-----------|--------|
| Entities | 1 tenant, 1 legal entity, 1 organization, 1 facility, 1–3 locations, 2–5 departments, 3–10 clinics, 5–20 practitioners |
| Hierarchy | Tenant → Legal Entity → Organization → Facility → Locations → Departments → Clinics |
| Network | Minimal: possibly 1–2 payer contracts, maybe a referral relationship with a nearby hospital |
| Tenant/CP implications | Simplest provisioning. Tenant ≈ organization ≈ facility in practical terms, but model keeps them distinct for future growth. |

### Scenario 2: 10-clinic network

| Dimension | Detail |
|-----------|--------|
| Entities | 1 tenant, 1 legal entity, 1 organization, 10 facilities, each with locations/departments/clinics |
| Hierarchy | Tenant → Legal Entity → Organization → 10 Facilities (each with internal hierarchy) |
| Network | Shared formulary, shared credentialing, referral among clinics, multiple payer contracts at organization level |
| Tenant/CP implications | Organization-level policies propagate to facilities. Tenant admin manages facilities within one org. |

### Scenario 3: One hospital + 5 clinics

| Dimension | Detail |
|-----------|--------|
| Entities | 1 tenant, 1 legal entity, 1 organization, 6 facilities (1 hospital + 5 clinics), hospital has wards + beds |
| Hierarchy | Tenant → Legal Entity → Organization → 6 Facilities. Hospital facility has inpatient wards with beds plus outpatient clinics. |
| Network | Hospital ancillaries (lab, radiology, pharmacy) are shared services for the 5 clinics. Cross-site practitioner privileges. |
| Tenant/CP implications | Shared-service affiliations required. Practitioners credentialed at multiple sites. |

### Scenario 4: Multi-hospital enterprise + ambulatory network

| Dimension | Detail |
|-----------|--------|
| Entities | 1 tenant, 1–2 legal entities, 3–5 organizations (hospital divisions + ambulatory groups), 15–50 facilities |
| Hierarchy | Tenant → Enterprise (optional) → Legal Entities → Organizations → Facilities → full internal hierarchies |
| Network | Enterprise-wide formularies, cross-facility credentialing, shared labs/radiology, multiple payer networks, referral pathways across divisions |
| Tenant/CP implications | Complex provisioning. Requires enterprise-level governance, potentially organization-specific policies within one tenant. |

### Scenario 5: Shared central lab/radiology/pharmacy

| Dimension | Detail |
|-----------|--------|
| Entities | Central service facility with lab/radiology/pharmacy departments, serving N client facilities |
| Hierarchy | Central service facility is a distinct facility under the same (or affiliated) organization |
| Network | Shared-service affiliations: each client facility has a service agreement with the central facility. Specimens/orders flow via integration, not containment. |
| Tenant/CP implications | If central service is under same tenant: affiliative relationship within tenant. If independent: cross-tenant service contract (future consideration). |

### Scenario 6: Referral network (not ownership)

| Dimension | Detail |
|-----------|--------|
| Entities | Multiple independent facilities (different legal entities, possibly different tenants) participating in a referral or ACO network |
| Hierarchy | Each facility has its own hierarchy within its own tenant |
| Network | Network entity connects facilities via affiliative relationships. No containment. Shared population health analytics. |
| Tenant/CP implications | Cross-tenant affiliations are a future design consideration. This model acknowledges the pattern conceptually but does not define cross-tenant data sharing mechanics. |

---

## 13. VistA-owned vs platform-owned concept boundary

This table is the authoritative boundary for organizational entities.

| Entity / concept | VistA canonical source | Platform role | Boundary rule |
|------------------|----------------------|---------------|---------------|
| Institution (facility clinical identity) | File 4 | Reference/map; provisioning metadata | Platform may read File 4 data. Must not replace it as clinical system of record. |
| Hospital Location (clinic, ward) | File 44 | Reference/map; configuration overlay | Platform may read File 44 data and supplement with platform-specific metadata. Must not replace File 44 as scheduling/ADT truth. |
| Ward Location | File 42 | Reference/map | Platform reads ward data for display. VistA owns inpatient bed management. |
| Bed Status | File 42.4 | Reference/map | VistA owns bed assignment. Platform may display. |
| Service/Section | File 40.8 | Reference/map; may extend with enterprise service-line concept | VistA owns clinical service assignment. Platform may group VistA services into enterprise service lines. |
| New Person (practitioner) | File 200 | Identity bridge; IdP record | Platform manages platform identity and SSO. VistA owns clinical user (DUZ, person class, keys). Identity bridge maps between them. |
| Person class / keys | File 200 subfields, XUSEC | Read-only reference | Platform may read for role inference. Must not write person class or keys. |
| Patient | Patient file, DFN | Portal identity bridge; attribution config | VistA is canonical patient record. Platform may hold portal-facing identity references. |
| Encounter / visit | Visit file, PCE | Analytics projection; read-only reference | VistA owns encounter truth. Platform may project for analytics. |
| Scheduling | File 44 appointments, SDES | Scheduling adapter (read + write via RPC) | VistA owns appointment truth. Platform accesses via scheduling adapter. |
| Insurance / coverage | IB/AR | Payer registry metadata; integration config | VistA owns patient insurance records. Platform manages payer registry metadata and connector configuration. |
| Tenant | — (not a VistA concept) | Fully platform-owned | Platform is canonical and sole owner. |
| Legal entity | — (not a VistA concept) | Fully platform-owned | Platform is canonical and sole owner. |
| Enterprise | — (not a VistA concept) | Fully platform-owned | Platform is canonical and sole owner. |
| Organization (enterprise operational grouping) | Division (loosely) | Platform-owned; may map to VistA Division | Platform defines; may bridge to VistA Division where applicable. |
| Network / affiliation | — | Fully platform-owned | Platform defines non-ownership relationships. |
| Capability / pack / module config | — | Fully platform-owned | No VistA analog. |
| Deployment profile | — | Fully platform-owned | No VistA analog. |

**Key principle:** Where VistA has canonical data (Files 4, 42, 42.4, 44, 200, 40.8), platform must bridge, reference, or map — never create a parallel system of record.

---

## 14. Identity and keying principles

These principles govern how entities are identified. No schema or implementation is defined here.

### 14.1 Canonical IDs vs external IDs

Every entity should have:

- **A canonical internal ID** assigned by the system that owns it (VistA IEN for VistA-owned entities; platform-generated UUID or similar for platform-owned entities).
- **Zero or more external IDs** from outside systems (NPI for practitioners, OID for facilities, payer-assigned IDs, national ID numbers).

Canonical IDs are stable and immutable. External IDs may change when external systems update.

### 14.2 Stable IDs vs mutable display names

- Entity **names** are mutable (facilities rename, organizations merge, practitioners change names).
- Entity **IDs** are stable (once assigned, they do not change).
- Any display surface must resolve names at render time, not cache them as if they were IDs.

### 14.3 Site-local codes vs enterprise-wide codes

| Code scope | Example | Implication |
|------------|---------|-------------|
| VistA-site-local | VistA IEN, File 44 location IEN | Unique within one VistA instance; not unique across instances |
| Enterprise-wide | Platform entity UUID, NPI | Unique across all sites within the tenant (or globally) |
| National/global | NPI, OID, PhilHealth PIN, national ID | Unique within their namespace; used for external interop |

**Architectural position:** Cross-site operations require enterprise-wide keys. VistA-site-local keys are valid only in the context of their VistA instance. Any cross-site reference, report, or analytics query must use enterprise-wide keys with VistA-local keys mapped through a master index or identity bridge.

### 14.4 Why keying matters before schemas

Key strategy must be decided before schemas are designed because:

- It determines whether entities can be referenced across sites.
- It affects how VistA data is correlated with platform data.
- It constrains FHIR resource identifiers and external integration.
- Getting it wrong creates unmergeable data silos.

This document establishes the principles. The schema spec will define concrete key formats and assignment strategies.

---

## 15. Provisioning and control-plane implications

### 15.1 Control-plane onboarding depends on this model

When a new customer onboards, the control plane must:

1. **Create a tenant** — the top-level isolation boundary.
2. **Select legal market** — determines applicable country/regulatory/payer packs.
3. **Register legal entity(ies)** — the legal body(ies) that will operate under this tenant.
4. **Define organizational structure** — how the legal entity's operations are grouped.
5. **Register facilities** — each physical site, linked to its VistA instance.
6. **Activate packs** — country, regulatory, payer, and specialty packs per facility/market.

The order and dependencies of these steps depend directly on the entity model defined in this document.

### 15.2 Tenant admin depends on this model

Once a tenant is provisioned, tenant administrators need to:

- Manage facilities, locations, departments, wards, beds within their tenant.
- Assign practitioners to facilities and roles.
- Configure site-specific parameters (VistA site params, printer defaults, shift schedules).
- Enable/disable modules within entitlements.

All of these operations reference entities defined in this model.

### 15.3 UI must wait for model stability

Per the global architecture spec Section 19, broad control-plane and tenant-admin UI is not authorized yet. This model must be accepted and stable before UI design begins. Screen contracts and workspace navigation will reference entity types defined here.

---

## 16. Pack implications

### 16.1 How packs relate to organizational entities

| Pack type | Attaches to | Example |
|-----------|-------------|---------|
| Country / legal-market | Tenant (legal-market selection) | Philippines market pack activates PhilHealth payer pack, PH locale, PH regulatory |
| Payer | Tenant or facility (payer contracts are facility-scoped or enterprise-scoped) | BCBS payer pack active for Acme Downtown Clinic |
| Specialty / content | Department or service line | Cardiology content pack active for Cardiology Department |
| Tenant overlay | Tenant | Acme-specific branding, defaults, feature flags |
| Language | Tenant or VistA instance (distro overlay) | Korean language pack for Korean-market tenant |
| Locale | Tenant | Philippine locale pack (date/currency/address formats) |
| Regulatory | Tenant (market-scoped) | HIPAA regulatory pack for US-market tenants |

### 16.2 What this model resolves for packs

- Packs need **entities to attach to** — this model defines them.
- Pack eligibility rules reference **legal-market, facility type, specialty** — this model defines what those terms mean.
- Pack activation scoping (enterprise-wide vs facility-specific vs department-specific) depends on the **containment hierarchy** defined here.

### 16.3 What remains for the next artifact

The next artifact (`pack-and-adapter-architecture-governance.md`) will define:

- Pack lifecycle (authoring, versioning, validation, activation, deactivation).
- Adapter contracts and swap mechanics.
- Pack dependency resolution.
- Pack eligibility evaluation against entity model.

This model provides the entity foundation that pack governance will build upon.

---

## 17. Access and governance implications

### 17.1 Context-sensitive role assignments

Access in VistA Evolved is not a flat user → permission mapping. It is scoped by organizational context:

- A practitioner may have **attending privileges** at Facility A but only **consulting privileges** at Facility B.
- A tenant admin may manage departments at Facility A but not at Facility B (delegated admin).
- A billing clerk may access revenue cycle data for Clinic Network A but not Hospital B.

This means permission evaluation must consider the **facility, location, department, service line, and/or specialty** context of the action.

### 17.2 Why later permission matrices depend on this model

Permission matrices (role × action × entity-context) cannot be designed until:

- Entity types are defined (this document).
- Role types are defined (this document, Section 9).
- Workspace boundaries are defined (global architecture Section 12).
- Screen contracts reference entity contexts (future spec).

### 17.3 Audit scope depends on this model

Audit events must include the organizational context in which the action occurred:

- Which tenant, facility, and department.
- Which practitioner and in which role.
- Which patient (if applicable).

Audit scoping, filtering, and compliance reporting all reference the entity model.

---

## 18. Resolved now vs deferred later

### 18.1 Resolved by this document

| Question | Resolution |
|----------|-----------|
| What are the canonical entity types for enterprise topology? | Section 5 vocabulary table |
| How do containment hierarchies differ from affiliative networks? | Section 6 |
| What is a tenant and how does it differ from legal entity, org, facility? | Section 7 |
| How are care-delivery structures (department, clinic, ward, bed) organized? | Section 8 |
| How do practitioner roles, privileges, and affiliations work conceptually? | Section 9 |
| How are patient care-context relationships modeled? | Section 10 |
| How are payer/program/sponsor relationships modeled? | Section 11 |
| Can the model handle single-clinic through multi-hospital enterprise? | Section 12 scenarios |
| What does VistA own vs what does platform own? | Section 13 boundary table |
| What identity and keying principles apply? | Section 14 |
| How does this model affect provisioning and control plane? | Section 15 |
| How does this model affect pack attachment? | Section 16 |
| How does this model affect access governance? | Section 17 |

### 18.2 Deferred to subsequent artifacts

| Question | Deferred to |
|----------|-------------|
| What is the pack lifecycle and adapter contract model? | Pack and adapter architecture governance spec |
| What are the concrete relational or document schemas? | Future schema specification |
| What are the FHIR resource mappings for these entities? | Future FHIR mapping specification |
| What are the API endpoints for entity CRUD? | Future OpenAPI contract work |
| What screens exist and how do they compose? | Information architecture workspace map + screen contract schema |
| What is the detailed payer registry structure? | Country and payer readiness registry spec |
| What is the detailed specialty content model? | Specialty content and analytics architecture spec |
| How are permission matrices structured? | Future RBAC/ABAC specification |
| How does cross-tenant data sharing work? | Future enterprise federation specification |

---

## 19. Explicit out-of-scope — not authorized by this document

This document does **not** define or authorize:

| Item | Status |
|------|--------|
| Relational database schema (tables, columns, foreign keys) | Deferred to future schema specification |
| JSON Schema or manifest schema for entity types | Deferred to future schema/contract work |
| FHIR Organization, Location, Practitioner, PractitionerRole mappings | Deferred to future interop specification |
| API endpoints for entity management | Deferred to future OpenAPI contract work |
| Screen inventory or navigation design | Deferred to information architecture workspace map |
| Tenant-admin UI implementation | Not authorized (global architecture Section 19) |
| Control-plane UI implementation | Not authorized (global architecture Section 19) |
| Detailed payer registry structure or claim format definitions | Deferred to country/payer readiness spec |
| Detailed specialty content model or rendering engine | Deferred to specialty/analytics architecture spec |
| Cross-tenant data sharing or federation mechanics | Not yet defined |
| Production deployment of any entity management feature | Not authorized |

---

## 20. Next artifact handoff

### What this spec resolves for the next artifact

The next planned artifact is **Pack and Adapter Architecture Governance** (`docs/explanation/pack-and-adapter-architecture-governance.md`), as specified in the global architecture backbone Section 20, item 2.

This current document provides the entity model foundation that pack governance needs:

- **Entity types** that packs attach to (tenant, facility, department, specialty, service line).
- **Containment hierarchy** that determines pack activation scope (enterprise-wide, facility-specific, department-specific).
- **Network/affiliation model** that determines how packs interact with cross-site relationships.
- **VistA vs platform ownership boundary** that constrains where pack configuration lives.
- **Identity and keying principles** that affect how packs reference entities.

### What the next spec must address

The pack and adapter architecture governance spec must define:

1. Pack lifecycle: authoring, versioning, validation, activation, deactivation.
2. Adapter contract model: VistA adapter, stub adapter, external adapters.
3. Pack dependency resolution: how packs declare and resolve prerequisites.
4. Pack eligibility evaluation: how entity context (market, facility type, specialty) determines applicable packs.
5. Pack composition: how multiple active packs combine without conflict.
6. Adapter swap mechanics: how adapters are selected and swapped at runtime.
7. Governance gates: how pack changes are reviewed, tested, and promoted.

!!! warning "Sequencing discipline"
    The next artifact must be authored, reviewed, and accepted before subsequent artifacts begin. Do not batch-generate the full specification sequence.
