import type { ComponentDefinition } from "./types";
import { componentDefinitions } from "./definitions";

export const componentDefinitionRegistry = new Map<string, ComponentDefinition>();

// Build the registry map on initialization
for (const def of componentDefinitions) {
    if (componentDefinitionRegistry.has(def.type)) {
        throw new Error(`Duplicate component type in registry: ${def.type}`);
    }
    componentDefinitionRegistry.set(def.type, def);
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
