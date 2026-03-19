/**
 * Contract-backed data loaders for the control-plane read-side subset.
 *
 * Loads canonical contract artifacts from packages/contracts/ and transforms
 * them into the API response shapes expected by the control-plane UI.
 *
 * Converted endpoints:
 *   - GET /api/control-plane/v1/legal-market-profiles
 *   - GET /api/control-plane/v1/legal-market-profiles/:legalMarketId
 *   - GET /api/control-plane/v1/capabilities
 *   - GET /api/control-plane/v1/effective-plans
 *
 * All other read routes remain fixture-backed.
 * No auth, no persistence, no write execution.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Resolve the packages/contracts/ directory relative to the control-plane app.
 * apps/control-plane/ → ../../packages/contracts/
 */
function contractsDir(appRoot) {
  return join(appRoot, '..', '..', 'packages', 'contracts');
}

// ---------------------------------------------------------------------------
// JSON file loader — fails honestly if a contract file is missing or invalid
// ---------------------------------------------------------------------------
async function loadJsonFile(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function loadAllJsonInDir(dirPath) {
  const entries = await readdir(dirPath);
  const jsonFiles = entries.filter(f => f.endsWith('.json'));
  const results = [];
  for (const f of jsonFiles) {
    results.push(await loadJsonFile(join(dirPath, f)));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Pack manifest index — keyed by packId, used to resolve displayName and
// lifecycle state for pack references in legal-market profiles.
// ---------------------------------------------------------------------------
async function loadPackManifestIndex(appRoot) {
  const dir = join(contractsDir(appRoot), 'pack-manifests');
  const manifests = await loadAllJsonInDir(dir);
  const index = new Map();
  for (const m of manifests) {
    index.set(m.packId, m);
  }
  return index;
}

// ---------------------------------------------------------------------------
// Legal Market Profiles
// ---------------------------------------------------------------------------

/** Transform a contract pack entry into the API summary shape */
function toPackSummary(packEntry, packIndex) {
  const manifest = packIndex.get(packEntry.packId);
  return {
    packId: packEntry.packId,
    packFamily: packEntry.packFamily,
    displayName: manifest ? manifest.displayName : packEntry.packId,
    lifecycleState: manifest ? manifest.lifecycle.state : 'draft',
  };
}

/** Transform contract readinessDimensions (object-keyed) to API array shape */
function toReadinessDimensionsArray(dimensionsObj) {
  return Object.entries(dimensionsObj).map(([dimension, value]) => ({
    dimension,
    state: value.state,
    scopeBounds: value.scopeBounds,
  }));
}

/** Transform a single legal-market profile contract artifact into the list-item shape */
function toMarketListItem(profile, packIndex) {
  return {
    legalMarketId: profile.legalMarketId,
    version: profile.version,
    displayName: profile.displayName,
    status: profile.status,
    launchTier: profile.launchTier,
    mandatedPackCount: profile.mandatedPacks.length,
    defaultOnPackCount: profile.defaultOnPacks.length,
    eligiblePackCount: profile.eligiblePacks.length,
    excludedPackCount: profile.excludedPacks.length,
    mandatedPacks: profile.mandatedPacks.map(p => toPackSummary(p, packIndex)),
    defaultOnPacks: profile.defaultOnPacks.map(p => toPackSummary(p, packIndex)),
    eligiblePacks: profile.eligiblePacks.map(p => toPackSummary(p, packIndex)),
    readinessDimensions: toReadinessDimensionsArray(profile.readinessDimensions),
  };
}

async function loadLegalMarketProfiles(appRoot) {
  const dir = join(contractsDir(appRoot), 'legal-market-profiles');
  const profiles = await loadAllJsonInDir(dir);
  const packIndex = await loadPackManifestIndex(appRoot);
  const items = profiles.map(p => toMarketListItem(p, packIndex));
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/** Transform a capability manifest into the API summary shape */
function toCapabilitySummary(manifest) {
  return {
    capabilityId: manifest.capabilityId,
    displayName: manifest.displayName,
    capabilityClass: manifest.capabilityClass || manifest.capabilityId.split('.')[0],
    capabilityName: manifest.capabilityId.split('.').slice(1).join('.'),
    readiness: {
      state: manifest.readiness.currentState,
      scopeBounds: manifest.readiness.scopeBounds,
    },
    packDependencies: manifest.packDependencies.map(d => d.packId),
    adapterDependencies: manifest.adapterDependencies.map(d => d.adapterId),
    claimPosture: manifest.claimPosture.currentClaimLevel,
  };
}

async function loadCapabilities(appRoot) {
  const dir = join(contractsDir(appRoot), 'capability-manifests');
  const manifests = await loadAllJsonInDir(dir);
  return {
    items: manifests.map(toCapabilitySummary),
  };
}

// ---------------------------------------------------------------------------
// Effective Plans
// ---------------------------------------------------------------------------

/** Derive a stable synthetic effectivePlanId from the filename */
function syntheticPlanId(plan) {
  // Use the contract's tenantId as the base for a deterministic ID
  const base = plan.tenantId || 'unknown';
  // Produce a simple deterministic hex-like ID
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-000000000000`;
}

/** Derive blockerType from contract gating-blocker fields */
function deriveBlockerType(b) {
  if (b.dimension === 'infrastructure') return 'infrastructure-missing';
  if (/\bhas no adapter\b|\bno adapter\b/i.test(b.blocker)) return 'adapter-integration-pending';
  return 'readiness-insufficient';
}

/** Transform contract readinessPosture to the API array-dimensions shape */
function toEffectivePlanPosture(posture) {
  // Contract posture has per-dimension keys with {state, scopeBounds, constrainingFactors}
  // API shape uses dimensions array + gatingBlockers
  const dimensionKeys = Object.keys(posture).filter(
    k => k !== 'effectiveLaunchTier' && k !== 'gatingBlockers'
  );
  const dimensions = dimensionKeys.map(dim => ({
    dimension: dim,
    state: posture[dim].state,
    scopeBounds: posture[dim].scopeBounds,
  }));
  const gatingBlockers = (posture.gatingBlockers || []).map(b => ({
    dimension: b.dimension,
    blockerType: deriveBlockerType(b),
    description: b.blocker,
  }));
  return {
    dimensions,
    effectiveLaunchTier: posture.effectiveLaunchTier,
    gatingBlockers,
  };
}

/** Transform a single effective-plan contract artifact into the API shape */
function toEffectivePlanItem(plan) {
  return {
    effectivePlanId: syntheticPlanId(plan),
    legalMarketId: plan.legalMarketId,
    profileVersion: plan.profileVersion,
    resolverVersion: plan.resolverVersion,
    resolvedAt: plan.generatedAt,
    resolvedPacks: plan.resolvedPacks,
    deferredItems: plan.deferredItems,
    readinessPosture: toEffectivePlanPosture(plan.readinessPosture),
    tenantSelections: plan.tenantSelections,
  };
}

async function loadEffectivePlans(appRoot) {
  const dir = join(contractsDir(appRoot), 'effective-tenant-configuration-plans');
  const plans = await loadAllJsonInDir(dir);
  return {
    plans: plans.map(toEffectivePlanItem),
  };
}

// ---------------------------------------------------------------------------
// Public API — load all contract-backed data at startup
// ---------------------------------------------------------------------------
export async function loadContractData(appRoot) {
  const legalMarketProfiles = await loadLegalMarketProfiles(appRoot);
  const capabilities = await loadCapabilities(appRoot);
  const effectivePlans = await loadEffectivePlans(appRoot);
  return { legalMarketProfiles, capabilities, effectivePlans };
}
