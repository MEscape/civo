import { flattenTree } from "@/modules/builder/domain/drop-placement";
import { tryGetComponentDefinition, getCurrentComponentVersion } from "@/modules/component-platform/domain";
import type { PageConfigInput } from "@/modules/builder/domain/page-schema";
import type { ReleaseComponentDependency } from "@/modules/release/domain/release-snapshot";

/**
 * Walks a page's node tree and resolves the CURRENT version of every
 * distinct component type it uses, along with that component's declared
 * contract dependencies (Phase 4 Rule 3 / Phase 9).
 *
 * "Current" here means "as registered right now" — this function is
 * meant to be called at publish time, when "right now" is the version
 * the release should be pinned to (see release-snapshot.ts's
 * ReleaseComponentDependency doc for why recording this matters). It is
 * NOT meant to be called against an old release's already-published
 * config to ask "what does this depend on today" — for an existing
 * release, its own stored `dependencies` array is the answer, precisely
 * because the registry may have moved on since it was published.
 *
 * An unresolvable type (not currently registered at all) is silently
 * skipped, matching findFirstContractIncompatibility's posture in
 * release-service.ts — an unknown type is render-nodes.tsx's concern
 * (placeholder at render time), not a dependency-extraction failure.
 */
export function extractComponentDependencies(config: PageConfigInput): ReleaseComponentDependency[] {
    const seen = new Map<string, ReleaseComponentDependency>();

    for (const { node } of flattenTree(config.children)) {
        if (seen.has(node.type)) continue;

        const definition = tryGetComponentDefinition(node.type);
        if (!definition) continue;

        const version = getCurrentComponentVersion(node.type);
        if (version === undefined) continue; // Unreachable if definition resolved, but keeps this total.

        seen.set(node.type, {
            type: node.type,
            version,
            contracts: (definition.dependsOnContracts ?? []).map((dependency) => ({
                contract: dependency.contract,
                minVersion: dependency.minVersion,
            })),
        });
    }

    return Array.from(seen.values());
}

/**
 * Merges the per-page dependency lists of a whole release into one
 * deduplicated-by-type list. Two pages using the same component type
 * always resolve to the same version (both come from the same registry
 * lookup at the same publish moment), so a plain last-write-wins merge
 * by `type` is safe here — there is no real conflict to detect.
 */
export function mergeComponentDependencies(
    perPage: ReleaseComponentDependency[][]
): ReleaseComponentDependency[] {
    const merged = new Map<string, ReleaseComponentDependency>();
    for (const dependencies of perPage) {
        for (const dependency of dependencies) {
            merged.set(dependency.type, dependency);
        }
    }
    return Array.from(merged.values());
}
