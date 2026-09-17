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
 */
export const componentDefinitionRegistry = new Map<string, ComponentDefinition>();

/**
 * Registers a batch of component definitions. Throws on a duplicate
 * `type` across ANY previously-registered batch, preserving the previous
 * "fail fast on a structural platform error" behavior.
 *
 * Idempotent per exact definition: calling this twice with the very same
 * `ComponentDefinition` objects (e.g. due to a module being re-evaluated)
 * is safe and a no-op for those entries, which matters in dev/HMR and in
 * tests that may import the registering module more than once.
 */
export function registerComponentDefinitions(definitions: ComponentDefinition[]): void {
    for (const def of definitions) {
        const existing = componentDefinitionRegistry.get(def.type);
        if (existing && existing !== def) {
            throw new Error(`Duplicate component type in registry: ${def.type}`);
        }
        componentDefinitionRegistry.set(def.type, def);
    }
}

/**
 * Returns an array of all registered component definitions.
 * Use this in UI components (like the component palette) to get a list
 * of available components without importing the infrastructure wiring file directly.
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
