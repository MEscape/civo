import { keyBy } from '@lib/utils';

import { isFullAccess } from './editor-capabilities';

import type { ComponentDescriptor } from './component-descriptor';
import type { EditorMode } from './editor-capabilities';

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
   * Prop keys a session in `mode` may change on a node of `type`, or `null`
   * when the mode is unrestricted. A restricted mode fails closed: an
   * unregistered type yields an empty set.
   */
  editablePropKeys(type: string, mode: EditorMode): ReadonlySet<string> | null;
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
    editablePropKeys(type, mode) {
      if (isFullAccess(mode)) {
        return null;
      }
      return entries.get(type)?.municipalPropKeys ?? NO_PROP_KEYS;
    },
  };
}
