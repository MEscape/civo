import { keyBy } from '@lib/utils';

import type { ComponentDescriptor } from './component-descriptor';

/** The nesting rules the tree operations need. */
export interface NestingPolicy {
  /** `parentType: null` is the page root. Unregistered types never nest. */
  canNest(parentType: string | null, childType: string): boolean;
  acceptsChildren(type: string): boolean;
}

export interface ComponentCatalog extends NestingPolicy {
  /** The data this catalog was built from; what the server sends to the client. */
  readonly descriptors: readonly ComponentDescriptor[];
  isRegistered(type: string): boolean;
  describe(type: string): ComponentDescriptor | null;

  /**
   * Prop keys an editor may change on a node of `type`, or `null` when
   * nothing is restricted (whoever may restructure pages). The restricted
   * editor fails closed: an unregistered type yields an empty set.
   */
  editablePropKeys(type: string, canRestructure: boolean): ReadonlySet<string> | null;
}

/** Everything the catalog looks up per type, computed once at construction. */
interface CatalogEntry {
  readonly descriptor: ComponentDescriptor;
  readonly childTypes: ReadonlySet<string>;
  readonly municipalPropKeys: ReadonlySet<string>;
}

const NO_PROP_KEYS: ReadonlySet<string> = new Set();

export function createComponentCatalog(
  descriptors: readonly ComponentDescriptor[],
): ComponentCatalog {
  const entries = keyBy(
    descriptors.map((descriptor): CatalogEntry => ({
      descriptor,
      childTypes: new Set(descriptor.allowedChildTypes),
      municipalPropKeys: new Set(descriptor.municipalPropKeys),
    })),
    (entry) => entry.descriptor.type,
  );

  return {
    descriptors,
    isRegistered: (type) => entries.has(type),
    describe: (type) => entries.get(type)?.descriptor ?? null,
    acceptsChildren: (type) => entries.get(type)?.descriptor.acceptsChildren ?? false,
    canNest(parentType, childType) {
      const child = entries.get(childType);
      if (child === undefined) {
        return false;
      }
      if (parentType === null) {
        return child.descriptor.isAllowedAtRoot;
      }
      return entries.get(parentType)?.childTypes.has(childType) ?? false;
    },
    editablePropKeys(type, canRestructure) {
      if (canRestructure) {
        return null;
      }
      return entries.get(type)?.municipalPropKeys ?? NO_PROP_KEYS;
    },
  };
}
