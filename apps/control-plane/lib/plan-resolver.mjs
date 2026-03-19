/**
 * Effective Configuration Plan Resolver — deterministic composition engine.
 *
 * Given a legal-market ID and optional tenant selections, this module computes
 * the resolved pack set, deferred items, dependency resolution, readiness
 * posture, and gating blockers. The output matches the effective-plan contract
 * schema in packages/contracts/effective-tenant-configuration-plans/.
 *
 * This is LOCAL-ONLY resolution — it reads from pre-loaded contractData
 * (pack manifests, market profiles) and produces a preview. It does NOT
 * persist plans, does NOT allocate tenant resources, and does NOT call any
 * external service. All output carries resolverVersion and mode markers.
 *
 * Resolver version: 1.0.0 — first honest composition engine.
 */

export const RESOLVER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Reason taxonomy for deferred items — deterministic, exhaustive
// ---------------------------------------------------------------------------
const DEFER_REASONS = {
  /** Pack manifest does not exist in the pack catalog */
  PACK_NOT_FOUND: 'pack-not-found',
  /** Pack manifest exists but lifecycle has not reached published */
  PACK_NOT_PUBLISHED: 'pack-not-published',
  /** Pack is eligible but the tenant did not select it */
  ELIGIBILITY_NOT_SELECTED: 'eligibility-not-selected',
  /** Pack was selected by tenant but failed eligibility conditions */
  ELIGIBILITY_FAILED: 'eligibility-failed',
  /** Pack was explicitly deselected by the tenant */
  TENANT_DESELECTED: 'tenant-deselected',
  /** Pack is excluded by market profile */
  MARKET_EXCLUDED: 'market-excluded',
  /** Pack dependency is unresolvable */
  DEPENDENCY_UNRESOLVABLE: 'dependency-unresolvable',
};

// ---------------------------------------------------------------------------
// Readiness dimension mapping — pack family → readiness dimension
// ---------------------------------------------------------------------------
const FAMILY_TO_DIMENSION = {
  language: 'language',
  locale: 'locale',
  regulatory: 'regulatory',
  'national-standards': 'nationalStandards',
  payer: 'payer',
  specialty: 'clinicalContent',
  'tenant-overlay': 'operational',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an effective configuration plan from contract data.
 *
 * @param {object} contractData - Pre-loaded contract data from contract-loader.mjs
 * @param {object} input - Resolution input
 * @param {string} input.legalMarketId - ISO 3166 alpha-2 market code
 * @param {string[]} [input.selectedPacks] - Packs the tenant wants to activate
 * @param {string[]} [input.deselectedDefaults] - Default-on packs the tenant wants off
 * @param {string} [input.facilityType] - Facility type hint
 * @param {string} [input.tenantDisplayName] - Display name for the tenant
 * @returns {{ ok: boolean, resolution?: object, error?: string }}
 */
export function resolveEffectivePlan(contractData, input) {
  const { legalMarketId, selectedPacks = [], deselectedDefaults = [], facilityType = '' } = input;

  // 1. Find the market profile
  const marketProfile = findMarketProfile(contractData, legalMarketId);
  if (!marketProfile) {
    return {
      ok: false,
      error: `Legal market "${legalMarketId}" not found in contract data.`,
    };
  }

  // 2. Build the pack index from loaded catalog
  const packIndex = contractData.packCatalog.detailIndex;

  // 3. Build the excluded set
  const excludedIds = new Set(
    (marketProfile.excludedPacks || []).map(p => typeof p === 'string' ? p : p.packId)
  );

  // 4. Resolve mandated packs — always included if manifest exists
  const resolved = [];
  const deferred = [];
  const resolvedIds = new Set();

  for (const entry of (marketProfile.mandatedPacks || [])) {
    const packId = typeof entry === 'string' ? entry : entry.packId;
    const result = resolvePackEntry(packId, 'mandated', entry, packIndex, excludedIds);
    if (result.resolved) {
      resolved.push(result.resolved);
      resolvedIds.add(packId);
    } else {
      deferred.push(result.deferred);
    }
  }

  // 5. Resolve default-on packs — included unless tenant deselected
  const deselectedSet = new Set(deselectedDefaults);
  for (const entry of (marketProfile.defaultOnPacks || [])) {
    const packId = typeof entry === 'string' ? entry : entry.packId;

    // Check deactivation constraints — some packs cannot be deselected
    const constraints = entry.deactivationConstraints || [];
    const canDeselect = constraints.length === 0;

    if (deselectedSet.has(packId) && canDeselect) {
      deferred.push({
        packId,
        reason: DEFER_REASONS.TENANT_DESELECTED,
        migrationPath: `Tenant deselected default-on pack "${packId}". Can re-enable at any time.`,
        targetState: 'specified',
      });
      continue;
    }

    const result = resolvePackEntry(packId, 'default-on', entry, packIndex, excludedIds);
    if (result.resolved) {
      resolved.push(result.resolved);
      resolvedIds.add(packId);
    } else {
      deferred.push(result.deferred);
    }
  }

  // 6. Resolve eligible packs — only if tenant selected them
  const selectedSet = new Set(selectedPacks);
  for (const entry of (marketProfile.eligiblePacks || [])) {
    const packId = typeof entry === 'string' ? entry : entry.packId;
    const manifest = packIndex.get(packId);

    if (!selectedSet.has(packId)) {
      // Not selected — record as deferred only if it would have been resolvable
      if (manifest) {
        deferred.push({
          packId,
          reason: DEFER_REASONS.ELIGIBILITY_NOT_SELECTED,
          migrationPath: `Pack "${packId}" is eligible for market "${legalMarketId}". Tenant may select it.`,
          targetState: manifest.lifecycle?.state === 'published' ? 'specified' : 'draft',
        });
      }
      continue;
    }

    // Tenant selected it — try to resolve
    if (!manifest) {
      deferred.push({
        packId,
        reason: DEFER_REASONS.ELIGIBILITY_FAILED,
        migrationPath: `Pack "${packId}" selected by tenant but no manifest exists in the pack catalog.`,
        targetState: 'draft',
      });
      continue;
    }

    const result = resolvePackEntry(packId, 'tenant-selected', entry, packIndex, excludedIds);
    if (result.resolved) {
      resolved.push(result.resolved);
      resolvedIds.add(packId);
    } else {
      deferred.push(result.deferred);
    }
  }

  // 7. Handle tenant-selected packs not in any market category
  for (const packId of selectedPacks) {
    if (resolvedIds.has(packId)) continue;
    if (deferred.some(d => d.packId === packId)) continue;
    if (excludedIds.has(packId)) {
      deferred.push({
        packId,
        reason: DEFER_REASONS.MARKET_EXCLUDED,
        migrationPath: `Pack "${packId}" is excluded by market "${legalMarketId}".`,
        targetState: 'n/a',
      });
      continue;
    }
    const manifest = packIndex.get(packId);
    if (!manifest) {
      deferred.push({
        packId,
        reason: DEFER_REASONS.PACK_NOT_FOUND,
        migrationPath: `Pack "${packId}" selected by tenant but no manifest exists in the pack catalog.`,
        targetState: 'draft',
      });
    }
    // Packs not in any market category but in the catalog — skip silently.
    // The resolver only composes packs grounded in market profile categories.
  }

  // 8. Dependency resolution pass — check all resolved packs' deps
  const depIssues = checkDependencies(resolved, resolvedIds, packIndex);

  // 9. Compute readiness posture from resolved packs + market profile
  const readinessPosture = computeReadinessPosture(resolved, deferred, marketProfile, packIndex);

  // 10. Build the output
  return {
    ok: true,
    resolution: {
      legalMarketId,
      profileVersion: marketProfile.version || '0.1.0',
      resolverVersion: RESOLVER_VERSION,
      resolvedAt: new Date().toISOString(),
      facilityType: facilityType || 'unspecified',
      resolvedPacks: resolved,
      deferredItems: deferred,
      dependencyIssues: depIssues,
      readinessPosture,
      tenantSelections: {
        selectedPacks,
        deselectedDefaults,
        facilityType: facilityType || 'unspecified',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Find a market profile by legalMarketId from loaded contractData */
function findMarketProfile(contractData, legalMarketId) {
  const items = contractData.legalMarketProfiles?.items || [];
  return items.find(m => m.legalMarketId === legalMarketId) || null;
}

/** Resolve a single pack entry. Returns { resolved } or { deferred }. */
function resolvePackEntry(packId, activationSource, marketEntry, packIndex, excludedIds) {
  if (excludedIds.has(packId)) {
    return {
      deferred: {
        packId,
        reason: DEFER_REASONS.MARKET_EXCLUDED,
        migrationPath: `Pack "${packId}" is excluded by market profile.`,
        targetState: 'n/a',
      },
    };
  }

  const manifest = packIndex.get(packId);
  if (!manifest) {
    return {
      deferred: {
        packId,
        reason: DEFER_REASONS.PACK_NOT_FOUND,
        migrationPath: `No pack manifest found for "${packId}". Manifest must be authored.`,
        targetState: 'draft',
      },
    };
  }

  const lifecycleState = manifest.lifecycle?.state || 'draft';
  const constraints = [];

  // Check lifecycle against mandated minimum
  if (activationSource === 'mandated') {
    const minState = marketEntry.minimumPackState || 'published';
    if (lifecycleState !== minState && lifecycleState !== 'published') {
      constraints.push(
        `Pack lifecycle is ${lifecycleState} but mandated minimum is ${minState}. Mandate cannot be enforced until pack reaches ${minState} state.`
      );
    }
  }

  if (lifecycleState === 'draft') {
    constraints.push(`Pack lifecycle is draft. No implemented runtime artifacts exist yet.`);
  }

  // Derive readinessState from the manifest
  const readinessState = deriveReadinessState(manifest);

  return {
    resolved: {
      packId,
      packFamily: manifest.packFamily || 'unknown',
      activationSource,
      packState: lifecycleState,
      readinessState,
      constraints,
    },
  };
}

/** Derive a readiness state from pack manifest content */
function deriveReadinessState(manifest) {
  const lifecycle = manifest.lifecycle?.state || 'draft';
  const artifactCount = manifest.contentSummary?.artifactCount || 0;
  const hasAdapters = (manifest.adapterRequirements || []).length > 0;

  if (lifecycle === 'published' && artifactCount > 0) return 'implemented';
  if (lifecycle === 'published') return 'validated';
  if (artifactCount > 0) return 'specified';
  if (hasAdapters) return 'declared';
  if (lifecycle === 'draft') return 'specified';
  return 'declared';
}

/** Check dependency satisfaction for all resolved packs */
function checkDependencies(resolvedPacks, resolvedIds, packIndex) {
  const issues = [];
  for (const rp of resolvedPacks) {
    const manifest = packIndex.get(rp.packId);
    if (!manifest) continue;
    for (const dep of (manifest.dependencies || [])) {
      const depPackId = dep.packId;
      if (!resolvedIds.has(depPackId)) {
        issues.push({
          packId: rp.packId,
          dependencyPackId: depPackId,
          dependencyType: dep.type || 'required',
          status: 'unresolved',
          detail: `"${rp.packId}" requires "${depPackId}" (${dep.type || 'required'}) which is not in the resolved set.`,
        });
      }
    }
  }
  return issues;
}

/** Compute readiness posture from resolved + deferred packs */
function computeReadinessPosture(resolvedPacks, deferredItems, marketProfile, packIndex) {
  const dimensions = {};
  const gatingBlockers = [];

  // Seed dimensions from resolved packs
  for (const rp of resolvedPacks) {
    const dim = FAMILY_TO_DIMENSION[rp.packFamily] || rp.packFamily;
    if (!dimensions[dim]) {
      dimensions[dim] = { state: rp.readinessState, scopeBounds: '', constrainingFactors: [] };
    }
    // Use worst-case readiness for the dimension
    dimensions[dim].state = worstReadiness(dimensions[dim].state, rp.readinessState);

    for (const c of (rp.constraints || [])) {
      dimensions[dim].constrainingFactors.push(c);
    }
  }

  // Carry forward market-profile readiness dimensions for unrepresented areas
  const profileDimensions = marketProfile.readinessDimensions || [];
  const dimEntries = Array.isArray(profileDimensions)
    ? profileDimensions
    : Object.entries(profileDimensions || {}).map(([k, v]) => ({ dimension: k, ...v }));

  for (const d of dimEntries) {
    const dim = d.dimension;
    if (!dimensions[dim]) {
      dimensions[dim] = {
        state: d.state || 'declared',
        scopeBounds: d.scopeBounds || '',
        constrainingFactors: [],
      };
    }
    if (d.scopeBounds && !dimensions[dim].scopeBounds) {
      dimensions[dim].scopeBounds = d.scopeBounds;
    }
  }

  // Compute gating blockers from mandated packs that are draft
  for (const rp of resolvedPacks) {
    if (rp.activationSource === 'mandated' && rp.packState !== 'published') {
      const dim = FAMILY_TO_DIMENSION[rp.packFamily] || rp.packFamily;
      gatingBlockers.push({
        dimension: dim,
        currentState: rp.readinessState,
        requiredState: 'implemented',
        blocker: `Pack "${rp.packId}" is ${rp.packState} (mandated but not published). Must reach published lifecycle and implemented readiness.`,
      });
    }
    // Check adapter requirements
    const manifest = packIndex.get(rp.packId);
    if (manifest) {
      for (const adp of (manifest.adapterRequirements || [])) {
        if (adp.required && adp.fallbackBehavior === 'integration-pending') {
          const dim = FAMILY_TO_DIMENSION[rp.packFamily] || rp.packFamily;
          gatingBlockers.push({
            dimension: dim,
            currentState: 'declared',
            requiredState: 'implemented',
            blocker: `Pack "${rp.packId}" requires adapter "${adp.adapterId}" which has no adapter. Fallback: ${adp.fallbackBehavior}.`,
          });
        }
      }
    }
  }

  // Effective launch tier — T0 if any gating blockers exist
  const effectiveLaunchTier = gatingBlockers.length > 0 ? 'T0' : 'T1';

  return {
    dimensions,
    effectiveLaunchTier,
    gatingBlockers,
  };
}

/** Return the worst (least mature) of two readiness states */
function worstReadiness(a, b) {
  const order = ['declared', 'specified', 'validated', 'implemented', 'verified'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  return (ia <= ib) ? a : b;
}
