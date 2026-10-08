import {
  boolean,
  list,
  number as numberField,
  object,
  oneOf,
  optional,
  text,
  url as urlField,
} from './field-schema';
import { ID_MAX_LENGTH } from './ids';

import type { FieldSchema, Infer, Shape } from './field-schema';
import type { ContentKind } from '../content/content-definitions';

export const PROP_CONTROLS = [
  'text',
  'textarea',
  'number',
  'select',
  'columns',
  'switch',
  'dataset',
  'items',
] as const;
export type PropControl = (typeof PROP_CONTROLS)[number];

/** Properties-panel sections, in the order they are shown. */
export const PROP_GROUPS = ['data', 'content', 'appearance'] as const;
export type PropGroup = (typeof PROP_GROUPS)[number];

// eslint-disable-next-line no-magic-numbers -- the allowed column counts are the definition itself
export const GRID_COLUMN_COUNTS = [1, 2, 3, 4] as const;
export type GridColumnCount = (typeof GRID_COLUMN_COUNTS)[number];

const NO_ITEMS = 0;

/** One field of an `items` entry, as the properties panel edits it. */
export interface PropItemField {
  readonly key: string;
  /** Edited in a multi-line field (an answer, a tab body) rather than a single line. */
  readonly multiline: boolean;
}

export interface PropBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * One editable prop, described once. The same description gives the value's
 * type, how a stored value is validated, what applies when it is missing or
 * invalid, and how the properties panel edits it. Labels, placeholders and
 * option labels are translations, never stored here.
 */
export interface PropField<T> {
  readonly control: PropControl;
  readonly group: PropGroup | null;
  /** Allowed values of a `select`/`columns`; their labels are translations keyed by value. */
  readonly options: ReadonlyArray<string | number>;
  readonly bounds: PropBounds | null;
  readonly hasPlaceholder: boolean;
  /** Whether a municipality admin may edit it. */
  readonly municipal: boolean;
  /** The fields of one entry of an `items` list, in display order; empty for every other control. */
  readonly itemFields: readonly PropItemField[];
  /** The kind a `dataset` prop accepts when it differs from the component's own data binding. */
  readonly datasetKind: ContentKind | null;
  readonly schema: FieldSchema<T>;
  /** Applies when the stored value is missing or invalid: the single place a default is written. */
  readonly fallback: T;
}

export interface PropMeta {
  readonly group?: PropGroup;
  readonly municipal?: boolean;
}

interface PropFieldInit<T> {
  readonly control: PropControl;
  readonly schema: FieldSchema<T>;
  readonly fallback: T;
  readonly meta: PropMeta | undefined;
  readonly options?: ReadonlyArray<string | number>;
  readonly bounds?: PropBounds;
  readonly hasPlaceholder?: boolean;
  readonly itemFields?: readonly PropItemField[];
  readonly datasetKind?: ContentKind | undefined;
}

function propField<T>(init: PropFieldInit<T>): PropField<T> {
  return {
    control: init.control,
    group: init.meta?.group ?? null,
    options: init.options ?? [],
    bounds: init.bounds ?? null,
    hasPlaceholder: init.hasPlaceholder ?? false,
    municipal: init.meta?.municipal ?? false,
    itemFields: init.itemFields ?? [],
    datasetKind: init.datasetKind ?? null,
    schema: init.schema,
    fallback: init.fallback,
  };
}

/** The builders a component definition uses to declare its props. */
export const prop = {
  /** Trimmed free text; absent or blank means "use the translated default". */
  text(
    max: number,
    meta?: PropMeta & { readonly placeholder?: boolean },
  ): PropField<string | undefined> {
    return propField({
      control: 'text',
      schema: optional(text({ max, trim: true })),
      fallback: undefined,
      meta,
      hasPlaceholder: meta?.placeholder ?? false,
    });
  },

  /** Like `text`, edited in a multi-line field. */
  longText(
    max: number,
    meta?: PropMeta & { readonly placeholder?: boolean },
  ): PropField<string | undefined> {
    return propField({
      control: 'textarea',
      schema: optional(text({ max, trim: true })),
      fallback: undefined,
      meta,
      hasPlaceholder: meta?.placeholder ?? false,
    });
  },

  /**
   * An address that ends up in `href`/`src`. Only http(s) or, when
   * allowed, a same-origin path (see `url` in field-schema); anything else
   * is invalid and so falls back to absent.
   */
  url(
    max: number,
    options: PropMeta & {
      readonly allowRelative: boolean;
      readonly placeholder?: boolean;
    },
  ): PropField<string | undefined> {
    return propField({
      control: 'text',
      schema: optional(urlField({ max, allowRelative: options.allowRelative })),
      fallback: undefined,
      meta: options,
      hasPlaceholder: options.placeholder ?? false,
    });
  },

  number(bounds: PropBounds & { readonly initial: number }, meta?: PropMeta): PropField<number> {
    return propField({
      control: 'number',
      schema: numberField({ min: bounds.min, max: bounds.max, integer: true }),
      fallback: bounds.initial,
      meta,
      bounds: { min: bounds.min, max: bounds.max },
    });
  },

  select<const V extends string>(options: readonly V[], initial: V, meta?: PropMeta): PropField<V> {
    return propField({
      control: 'select',
      schema: oneOf(options),
      fallback: initial,
      meta,
      options,
    });
  },

  columns(initial: GridColumnCount, meta?: PropMeta): PropField<GridColumnCount> {
    return propField({
      control: 'columns',
      schema: oneOf(GRID_COLUMN_COUNTS),
      fallback: initial,
      meta,
      options: GRID_COLUMN_COUNTS,
    });
  },

  switch(initial: boolean, meta?: PropMeta): PropField<boolean> {
    return propField({
      control: 'switch',
      schema: boolean(),
      fallback: initial,
      meta,
    });
  },

  /**
   * A bounded list of small records. One invalid entry makes the
   * whole list fall back to empty, like any other invalid prop.
   */
  items<S extends Shape>(
    shape: S,
    max: number,
    meta?: PropMeta & { readonly multiline?: ReadonlyArray<keyof S & string> },
  ): PropField<ReadonlyArray<Infer<S>>> {
    const multiline: readonly string[] = meta?.multiline ?? [];
    return propField({
      control: 'items',
      schema: list(object(shape), max),
      fallback: [],
      meta,
      bounds: { min: NO_ITEMS, max },
      itemFields: Object.keys(shape).map((key) => ({
        key,
        multiline: multiline.includes(key),
      })),
    });
  },

  /**
   * Reference to a dataset of the same website; ownership is checked when it
   * is read. Pass `kind` when the component has several dataset props of
   * different kinds; without it the component's own data binding applies.
   */
  dataset(kind?: ContentKind): PropField<string | undefined> {
    return propField({
      control: 'dataset',
      schema: optional(text({ min: 1, max: ID_MAX_LENGTH, trim: true })),
      fallback: undefined,
      meta: { group: 'data' },
      datasetKind: kind,
    });
  },
} as const;
