import type { ComponentDefinition } from "./types";

/**
 * The component registry — domain-owned, but populated from outside.
 *
 * This file must stay framework-free (no imports of React component
 * modules), so it does NOT assemble the list of definitions itself. The
 * platform's `infrastructure` layer collects each feature module's
 * `ComponentDefinition[]` (layout, content, civic, smartcity — each of
 * which legitimately needs to import from `module-components` to wire up
 * `createDefaultNode`/render concerns) and calls
 * `registerComponentDefinitions` once at startup — see
 * `component-platform/infrastructure/definitions.ts`.
 *
 * Everything below this point (the query functions) has no knowledge of
 * *how* the registry was populated, which is what keeps this module a
 * legitimate `domain/**` dependency for other modules' domain layers
 * (builder/domain/page-node.ts, builder/domain/drop-placement.ts) without
 * ever pulling UI code along with it transitively.
 *
 * VERSIONING (Phase 4 Rule 3 / Phase 3): `componentDefinitionRegistry`
 * keeps its original shape and contract exactly — a `Map<type,
 * ComponentDefinition>` resolving every bare-`type` lookup to that type's
 * CURRENT version, so every existing call site (render-nodes.tsx's
 * componentMap lookups, the properties panel, drop-placement,
 * PageNode.type — none of which carry a version) keeps working
 * unchanged. Multiple versions of the same `type` are additionally kept
 * in `versionsByType`, queryable only through the explicit
 * version-aware functions below. A definition with no `version` field is
 * treated as version 1.
 */
export const componentDefinitionRegistry = new Map<string, ComponentDefinition>();

/**
 * All registered versions of every type, including the current one
 * already present in `componentDefinitionRegistry`. Keyed by type, then
 * by version number. Not exported directly — see the query functions
 * below, which are the intended public surface (mirrors why
 * `componentDefinitionRegistry` itself is only exported for tests/inspection
 * rather than as the primary way to query).
 */
const versionsByType = new Map<string, Map<number, ComponentDefinition>>();

/**
 * Resets all registry state. `componentDefinitionRegistry.clear()` alone
 * is no longer sufficient once definitions can have multiple versions —
 * it would leave `versionsByType` (module-private) stale across test
 * cases. Tests should call this instead of reaching into
 * `componentDefinitionRegistry.clear()` directly.
 */
export function clearComponentRegistry(): void {
    componentDefinitionRegistry.clear();
    versionsByType.clear();
}

function versionOf(def: ComponentDefinition): number {
    return def.version ?? 1;
}

/**
 * Registers a batch of component definitions.
 *
 * Two definitions sharing a `type` are only accepted together when they
 * declare DIFFERENT explicit `version` numbers — that is a deliberate
 * multi-version registration (old and new coexisting, Phase 3's
 * deliverable). Two definitions sharing both `type` AND version (the
 * original "duplicate type" case, including the common case where
 * neither sets `version` and both default to 1) still throws exactly as
 * before: that combination can only mean an accidental duplicate
 * registration, not an intentional new version.
 *
 * The current/"latest" version for a type is whichever has the highest
 * version number registered so far — registration order does not need
 * to be ascending, but in practice definitions are registered once at
 * startup in the order infrastructure/definitions.ts assembles them.
 *
 * Idempotent per exact definition: calling this twice with the very same
 * `ComponentDefinition` object (e.g. due to a module being re-evaluated)
 * is safe and a no-op for that entry, which matters in dev/HMR and in
 * tests that may import the registering module more than once.
 */
export function registerComponentDefinitions(definitions: ComponentDefinition[]): void {
    for (const def of definitions) {
        const version = versionOf(def);
        let versions = versionsByType.get(def.type);
        if (!versions) {
            versions = new Map();
            versionsByType.set(def.type, versions);
        }

        const existingAtVersion = versions.get(version);
        if (existingAtVersion && existingAtVersion !== def) {
            throw new Error(
                `Duplicate component type in registry: ${def.type}${
                    def.version !== undefined ? `@${version}` : ""
                }`
            );
        }
        versions.set(version, def);

        const currentVersion = componentDefinitionRegistry.get(def.type);
        if (!currentVersion || version >= versionOf(currentVersion)) {
            componentDefinitionRegistry.set(def.type, def);
        }
    }
}

/**
 * Returns an array of all registered component definitions, one per
 * type — the CURRENT version of each, matching
 * `componentDefinitionRegistry`'s contract (e.g. for the component
 * palette). Use `getComponentVersionHistory` to see every version of a
 * given type.
 */
export function getAllComponentDefinitions(): ComponentDefinition[] {
    return Array.from(componentDefinitionRegistry.values());
}

/**
 * Type guard for validating component types.
 */
export function isRegisteredComponentType(type: string): boolean {
    return componentDefinitionRegistry.has(type);
}

/**
 * Retrieves a component definition. Throws if missing, because a missing
 * definition represents a structural platform error, not a runtime user
 * error.
 */
export function getComponentDefinition(type: string): ComponentDefinition {
    const def = componentDefinitionRegistry.get(type);
    if (!def) {
        throw new Error(`Unknown component type: ${type}`);
    }
    return def;
}

/**
 * Use this for any runtime caller that might encounter user-authored or
 * historical data referencing a type that no longer exists (a properties
 * panel, a migration script, etc.) — it degrades gracefully instead of
 * crashing the whole builder on one bad node.
 */
export function tryGetComponentDefinition(type: string): ComponentDefinition | undefined {
    return componentDefinitionRegistry.get(type);
}

/**
 * Looks up a SPECIFIC version of a component type, regardless of which
 * version is current. Returns `undefined` if that type or that exact
 * version was never registered.
 *
 * Intended for callers that must respect a version an existing release
 * or draft was built against (the compatibility engine, three-way
 * migration) rather than silently resolving to whatever is current —
 * see Phase 4 Rule 5: "upgrades are migrations, not mutations."
 */
export function tryGetComponentDefinitionVersion(
    type: string,
    version: number
): ComponentDefinition | undefined {
    return versionsByType.get(type)?.get(version);
}

/**
 * All registered versions of a component type, ascending by version
 * number. Empty array if the type was never registered. Intended for
 * migration-planning UI (Phase 14) and the future compatibility engine.
 */
export function getComponentVersionHistory(type: string): ComponentDefinition[] {
    const versions = versionsByType.get(type);
    if (!versions) return [];
    return Array.from(versions.entries())
        .sort(([a], [b]) => a - b)
        .map(([, def]) => def);
}

/**
 * The version number of a type's current definition — the same one
 * `getComponentDefinition(type)` resolves to. Returns `undefined` for an
 * unregistered type.
 */
export function getCurrentComponentVersion(type: string): number | undefined {
    const def = componentDefinitionRegistry.get(type);
    return def ? versionOf(def) : undefined;
}

/**
 * Helper to determine if one component is allowed to be a child of another.
 * Used by the builder UI to prevent invalid drag-and-drop operations.
 */
export function canInsertChild(parentType: string | null, childType: string): boolean {
    if (!componentDefinitionRegistry.has(childType)) return false;
    if (parentType === null || parentType === "root") return true;

    const parentDef = componentDefinitionRegistry.get(parentType);
    if (!parentDef || !parentDef.canHaveChildren) return false;

    const childDef = componentDefinitionRegistry.get(childType);
    if (!childDef) return false;

    if (parentDef.acceptsChildTypes) {
        return parentDef.acceptsChildTypes.includes(childType);
    }

    return true; // Parent allows children and has no specific restrictions
}

export type ContractCompatibilityIssue = {
    contract: string;
    required: number;
    actual: number;
};

/**
 * Checks a component definition's declared contract dependencies
 * (`dependsOnContracts`) against the contract versions currently in
 * force (content/domain/contract-versions). This is deliberately narrow
 * — the seed of Phase 11's compatibility engine, not the engine itself:
 * it only ever compares against the CURRENT contract version, not a
 * specific dataset/mapping's produced version (there is no such entity
 * yet to compare against — see contract-versions.ts's scope note).
 *
 * A component with no `dependsOnContracts` is always compatible (there
 * is nothing declared to check), matching that field's documented
 * "absence means nothing to check" semantics.
 */
export function checkComponentContractCompatibility(
    def: ComponentDefinition,
    currentVersionOf: (contract: string) => number
): { compatible: true } | { compatible: false; issues: ContractCompatibilityIssue[] } {
    if (!def.dependsOnContracts || def.dependsOnContracts.length === 0) {
        return { compatible: true };
    }

    const issues: ContractCompatibilityIssue[] = [];
    for (const dependency of def.dependsOnContracts) {
        const actual = currentVersionOf(dependency.contract);
        if (actual < dependency.minVersion) {
            issues.push({ contract: dependency.contract, required: dependency.minVersion, actual });
        }
    }

    return issues.length === 0 ? { compatible: true } : { compatible: false, issues };
}
