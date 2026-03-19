/**
 * Startup Drift Audit — compares resolver-computed defaults to seed plans.
 *
 * For each seed effective plan in packages/contracts/effective-tenant-configuration-plans/,
 * this module runs the resolver with the same inputs and compares the output against
 * the seed plan contents. Honest differences are reported as drift items.
 *
 * Drift categories:
 *   - pack-count-changed: resolver computes different number of resolved packs
 *   - deferred-reason-changed: seed deferred reason doesn't match resolver's reason
 *   - deferred-item-added: resolver defers something the seed doesn't mention
 *   - deferred-item-removed: seed defers something the resolver doesn't
 *   - resolver-version-stale: seed uses older resolverVersion
 *   - pack-missing-from-resolver: seed has a pack the resolver didn't resolve
 *   - pack-added-by-resolver: resolver resolved a pack the seed doesn't have
 *
 * This is informational only — drift does not block startup.
 */

import { resolveEffectivePlan, RESOLVER_VERSION } from './plan-resolver.mjs';

/**
 * Run a drift audit comparing seed plans to live-resolved output.
 *
 * @param {object} contractData - Pre-loaded contract data from contract-loader.mjs
 * @returns {{ driftItems: Array, summary: string }}
 */
export function runDriftAudit(contractData) {
  const driftItems = [];
  const plans = contractData.effectivePlans?.plans || [];

  for (const seedPlan of plans) {
    const marketId = seedPlan.legalMarketId;
    const selections = seedPlan.tenantSelections || {};

    // Re-resolve with the same inputs
    const result = resolveEffectivePlan(contractData, {
      legalMarketId: marketId,
      selectedPacks: selections.selectedPacks || [],
      deselectedDefaults: selections.deselectedDefaults || [],
      facilityType: selections.facilityType || '',
    });

    if (!result.ok) {
      driftItems.push({
        planId: seedPlan.effectivePlanId,
        legalMarketId: marketId,
        category: 'resolver-error',
        detail: `Resolver failed for market "${marketId}": ${result.error}`,
        severity: 'error',
      });
      continue;
    }

    const resolved = result.resolution;

    // Check resolver version
    if (seedPlan.resolverVersion !== RESOLVER_VERSION) {
      driftItems.push({
        planId: seedPlan.effectivePlanId,
        legalMarketId: marketId,
        category: 'resolver-version-stale',
        detail: `Seed resolverVersion="${seedPlan.resolverVersion}" vs current="${RESOLVER_VERSION}"`,
        severity: 'info',
      });
    }

    // Compare resolved pack counts
    const seedPackIds = new Set((seedPlan.resolvedPacks || []).map(p => p.packId));
    const resolvedPackIds = new Set(resolved.resolvedPacks.map(p => p.packId));

    if (seedPackIds.size !== resolvedPackIds.size) {
      driftItems.push({
        planId: seedPlan.effectivePlanId,
        legalMarketId: marketId,
        category: 'pack-count-changed',
        detail: `Seed has ${seedPackIds.size} resolved packs, resolver computes ${resolvedPackIds.size}`,
        severity: 'warning',
      });
    }

    // Packs in seed but not resolver
    for (const pid of seedPackIds) {
      if (!resolvedPackIds.has(pid)) {
        driftItems.push({
          planId: seedPlan.effectivePlanId,
          legalMarketId: marketId,
          category: 'pack-missing-from-resolver',
          detail: `Seed has "${pid}" as resolved but resolver did not include it`,
          severity: 'warning',
        });
      }
    }

    // Packs in resolver but not seed
    for (const pid of resolvedPackIds) {
      if (!seedPackIds.has(pid)) {
        driftItems.push({
          planId: seedPlan.effectivePlanId,
          legalMarketId: marketId,
          category: 'pack-added-by-resolver',
          detail: `Resolver includes "${pid}" which is not in the seed plan`,
          severity: 'info',
        });
      }
    }

    // Compare deferred items
    const seedDeferred = new Map((seedPlan.deferredItems || []).map(d => [d.packId, d]));
    const resolvedDeferred = new Map(resolved.deferredItems.map(d => [d.packId, d]));

    for (const [packId, seedDef] of seedDeferred) {
      const resDef = resolvedDeferred.get(packId);
      if (!resDef) {
        driftItems.push({
          planId: seedPlan.effectivePlanId,
          legalMarketId: marketId,
          category: 'deferred-item-removed',
          detail: `Seed defers "${packId}" (reason: ${seedDef.reason}) but resolver does not defer it`,
          severity: 'info',
        });
      } else if (resDef.reason !== seedDef.reason) {
        driftItems.push({
          planId: seedPlan.effectivePlanId,
          legalMarketId: marketId,
          category: 'deferred-reason-changed',
          detail: `"${packId}" seed reason="${seedDef.reason}" vs resolver reason="${resDef.reason}"`,
          severity: 'warning',
        });
      }
    }

    for (const [packId, resDef] of resolvedDeferred) {
      if (!seedDeferred.has(packId)) {
        driftItems.push({
          planId: seedPlan.effectivePlanId,
          legalMarketId: marketId,
          category: 'deferred-item-added',
          detail: `Resolver defers "${packId}" (reason: ${resDef.reason}) which seed does not mention`,
          severity: 'info',
        });
      }
    }
  }

  const errorCount = driftItems.filter(d => d.severity === 'error').length;
  const warnCount = driftItems.filter(d => d.severity === 'warning').length;
  const infoCount = driftItems.filter(d => d.severity === 'info').length;
  const summary = driftItems.length === 0
    ? `Drift audit clean — ${plans.length} seed plan(s), 0 drift items`
    : `Drift audit: ${driftItems.length} item(s) across ${plans.length} seed plan(s) [${errorCount} error, ${warnCount} warning, ${infoCount} info]`;

  return { driftItems, summary };
}
