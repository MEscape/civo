import type { CatalogFieldView, ComponentCatalogEntry } from '@modules/component-platform';

import { invariant, isJsonRecord } from '@lib/utils';

import { PAGE_TREE_LIMITS } from '../../domain/models/page-node';

import type {
  ComponentDescriptor,
  NodeBlueprint,
  PropFieldDescriptor,
} from '../../domain/models/component-descriptor';
import type { ComponentDescriptorProvider } from '../../domain/ports/component-descriptor-provider.port';

/** The platform's own nesting rule; `parentType: null` is the page root. */
export type CanNestFn = (parentType: string | null, childType: string) => boolean;

function toFieldDescriptor(field: CatalogFieldView): PropFieldDescriptor {
  return {
    key: field.key,
    control: field.control,
    labelKey: field.labelKey,
    placeholderKey: field.placeholderKey,
    group: field.group,
    options: field.options.map((option) => ({
      value: option.value,
      labelKey: option.labelKey,
    })),
    bounds: field.bounds,
    canonicalKind: field.canonicalKind,
    itemFields: field.itemFields.map((itemField) => ({
      key: itemField.key,
      labelKey: itemField.labelKey,
      multiline: itemField.multiline,
    })),
  };
}

function toBlueprint(entry: ComponentCatalogEntry): NodeBlueprint {
  // Default props are a platform contract, not user input: a violation is a platform bug, so fail fast at startup.
  invariant(
    isJsonRecord(entry.blueprint.props, PAGE_TREE_LIMITS.maxPropsDepth),
    `Component "${entry.type}" has default props that are not plain JSON.`,
  );
  return { type: entry.type, props: entry.blueprint.props, children: [] };
}

function toDescriptor(
  entry: ComponentCatalogEntry,
  all: readonly ComponentCatalogEntry[],
  canNest: CanNestFn,
): ComponentDescriptor {
  return {
    type: entry.type,
    category: entry.category,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    acceptsChildren: entry.canHaveChildren,
    // The platform's own nesting rule, evaluated once and shipped as data.
    allowedChildTypes: all
      .filter((child) => canNest(entry.type, child.type))
      .map((child) => child.type),
    isAllowedAtRoot: canNest(null, entry.type),
    fields: entry.fields.map(toFieldDescriptor),
    municipalPropKeys: [...entry.municipalFields],
    blueprint: toBlueprint(entry),
  };
}

/**
 * The builder's ONLY view of the component platform: its published catalog
 * and nesting rule, handed in by `composition.ts`. Registry internals
 * (render functions, prop parsers) never cross this boundary; descriptors
 * are plain JSON.
 */
export class ComponentPlatformDescriptorProvider implements ComponentDescriptorProvider {
  constructor(
    private readonly catalog: readonly ComponentCatalogEntry[],
    private readonly canNest: CanNestFn,
  ) {}

  listDescriptors(): readonly ComponentDescriptor[] {
    return this.catalog.map((entry) => toDescriptor(entry, this.catalog, this.canNest));
  }
}
