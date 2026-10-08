import type {
  CatalogBoundsView,
  ComponentCategory,
  ContentKind,
  PropControl,
  PropGroup,
} from '@modules/component-platform/client';

import type { PageNodeProps } from './page-node';

/*
 * What the builder needs to know about a component, as PLAIN DATA. The
 * component platform owns the components and their vocabulary (categories,
 * controls, groups, content kinds); those are imported as types from its
 * public API and never redeclared here. One adapter turns the platform's
 * catalog into descriptors (`ComponentDescriptorProvider`). Because
 * descriptors are serializable, the server hands them to the client and BOTH
 * sides build the same catalog with `createComponentCatalog`: one
 * implementation of the nesting and edit rules instead of a server copy and
 * a client copy.
 *
 * Display text is carried as translation KEYS, exactly as the platform
 * publishes it. The catalog is built once per process, so it cannot hold
 * locale-dependent text; the presentation resolves keys per request.
 */

export interface PropOptionDescriptor {
  readonly value: string | number;
  /** `null`: the value is its own label (numbers). */
  readonly labelKey: string | null;
}

/** One field of an `items` entry, e.g. the question of an FAQ entry. */
export interface PropItemFieldDescriptor {
  readonly key: string;
  readonly labelKey: string;
  readonly multiline: boolean;
}

/**
 * One editable prop. Explicit `null`s instead of optional keys keep the
 * shape uniform and JSON-safe.
 */
export interface PropFieldDescriptor {
  readonly key: string;
  readonly control: PropControl;
  readonly labelKey: string;
  readonly placeholderKey: string | null;
  readonly group: PropGroup | null;
  /** Only meaningful for `select`; empty otherwise. */
  readonly options: readonly PropOptionDescriptor[];
  /** Limits of a `number` control, as the platform declares them. */
  readonly bounds: CatalogBoundsView | null;
  /** The content kind a `dataset` control filters by. */
  readonly canonicalKind: ContentKind | null;
  /** The fields of one entry of an `items` control; empty otherwise. */
  readonly itemFields: readonly PropItemFieldDescriptor[];
}

/** A node without identity: ids are assigned when it is instantiated. */
export interface NodeBlueprint {
  readonly type: string;
  readonly props: PageNodeProps;
  readonly children: readonly NodeBlueprint[];
}

export interface ComponentDescriptor {
  readonly type: string;
  readonly category: ComponentCategory;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly acceptsChildren: boolean;
  /**
   * Child types this component accepts. The adapter precomputes it from the
   * platform's nesting rule, so the rule travels as data. Empty for leaves.
   */
  readonly allowedChildTypes: readonly string[];
  readonly isAllowedAtRoot: boolean;
  readonly fields: readonly PropFieldDescriptor[];
  /**
   * Prop keys a municipality editor may change. Today `municipality` is the
   * only restricted mode; a second one means a per-mode map here.
   */
  readonly municipalPropKeys: readonly string[];
  /** The default node a fresh instance starts from. */
  readonly blueprint: NodeBlueprint;
}
