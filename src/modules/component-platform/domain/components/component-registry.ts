import { invariant } from '@lib/utils';

import type { ComponentDefinition } from '../models/component-definition';

/** Pseudo-parent for "directly on the page". */
export const ROOT_PARENT = null;

export interface ComponentRegistry {
  list(): readonly ComponentDefinition[];
  find(type: string): ComponentDefinition | undefined;
  /** Whether `childType` may be inserted under `parentType` (`null`: the page root). */
  canNest(parentType: string | null, childType: string): boolean;
}

/**
 * Builds an immutable registry and rejects an inconsistent set once, at
 * start-up: a duplicate type, a nesting rule naming a component that does
 * not exist, or a dataset prop with no declared kind are programmer errors,
 * not runtime conditions.
 */
export function createComponentRegistry(
  definitions: readonly ComponentDefinition[],
): ComponentRegistry {
  const byType = new Map<string, ComponentDefinition>();
  for (const definition of definitions) {
    invariant(!byType.has(definition.type), `Duplicate component type "${definition.type}".`);
    byType.set(definition.type, definition);
  }

  for (const definition of definitions) {
    for (const child of definition.acceptsChildTypes ?? []) {
      invariant(
        byType.has(child),
        `"${definition.type}" accepts the unknown component type "${child}".`,
      );
    }
    for (const field of definition.fields) {
      invariant(
        field.control !== 'dataset' ||
          field.datasetKind !== null ||
          definition.dataBinding !== null,
        `"${definition.type}" has the dataset prop "${field.key}" but declares no data binding for it.`,
      );
    }
  }

  return {
    list: () => definitions,
    find: (type) => byType.get(type),
    canNest(parentType, childType) {
      if (!byType.has(childType)) {
        return false;
      }
      if (parentType === ROOT_PARENT) {
        return true;
      }

      const parent = byType.get(parentType);
      if (!parent?.canHaveChildren) {
        return false;
      }
      return parent.acceptsChildTypes?.includes(childType) ?? true;
    },
  };
}
