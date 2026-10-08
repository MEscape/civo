import { isPlainObject } from '@lib/utils';

import type { ContentKind } from '../content/content-definitions';
import type {
  ComponentCategory,
  ComponentDefinition,
  ContractDependency,
  PropFieldDefinition,
} from '../models/component-definition';
import type { PropField } from '../models/prop-field';

const INITIAL_VERSION = 1;
const INITIAL_CONTRACT_VERSION = 1;

/** The props of one component, keyed by prop name. Key order is the order the panel shows. */
export type PropSet = Readonly<Record<string, PropField<unknown>>>;

/** The parsed props a component's render function receives. */
export type PropsOf<P extends PropSet> = {
  readonly [K in keyof P]: P[K] extends PropField<infer T> ? T : never;
};

export interface ComponentSpec<TType extends string, P extends PropSet> {
  readonly type: TType;
  readonly version?: number;
  readonly category: ComponentCategory;
  readonly props: P;
  readonly municipallyEditable?: boolean;
  readonly canHaveChildren?: boolean;
  readonly acceptsChildTypes?: readonly string[];
  /**
   * The canonical kind the component renders. Declaring it once also pins
   * the contract dependency a release checks, so the two cannot disagree.
   */
  readonly dataBinding?: {
    readonly kind: ContentKind;
    readonly minVersion?: number;
  };
}

/**
 * Default props are stored and merged as JSON, which has no `undefined`: an
 * optional prop that starts unset is simply absent from the defaults.
 * (`parseProps` keeps it, so a render function still sees `undefined`.)
 */
function withoutUndefined(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined));
}

function toFieldDefinition(key: string, field: PropField<unknown>): PropFieldDefinition {
  return {
    key,
    control: field.control,
    group: field.group,
    options: field.options,
    bounds: field.bounds,
    hasPlaceholder: field.hasPlaceholder,
    itemFields: field.itemFields,
    datasetKind: field.datasetKind,
  };
}

/**
 * Parses stored props leniently: each prop is checked on its own and an
 * invalid or missing one takes its fallback, so valid siblings keep the
 * editor's values.
 */
function restoreProps(props: PropSet, raw: unknown): Record<string, unknown> {
  const source = isPlainObject(raw) ? raw : {};
  const restored: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(props)) {
    const outcome = field.schema.parse(source[key]);
    restored[key] = outcome.ok ? outcome.value : field.fallback;
  }
  return restored;
}

/**
 * Builds a component definition from its prop fields. Each prop is written
 * once: its type, its validation, its default and its editor control all
 * come from the same declaration.
 */
export function defineComponent<const TType extends string, P extends PropSet>(
  spec: ComponentSpec<TType, P>,
): ComponentDefinition<PropsOf<P>> & { readonly type: TType } {
  const entries = Object.entries(spec.props);
  const canHaveChildren = spec.canHaveChildren ?? false;
  const binding = spec.dataBinding;
  const dependsOnContracts: readonly ContractDependency[] =
    binding === undefined
      ? []
      : [
          {
            contract: binding.kind,
            minVersion: binding.minVersion ?? INITIAL_CONTRACT_VERSION,
          },
        ];

  return {
    type: spec.type,
    version: spec.version ?? INITIAL_VERSION,
    category: spec.category,
    canHaveChildren,
    acceptsChildTypes: canHaveChildren ? (spec.acceptsChildTypes ?? null) : [],
    fields: entries.map(([key, field]) => toFieldDefinition(key, field)),
    municipalFields: entries.filter(([, field]) => field.municipal).map(([key]) => key),
    municipallyEditable: spec.municipallyEditable ?? false,
    dataBinding: binding === undefined ? null : { canonicalKind: binding.kind },
    dependsOnContracts,
    defaultProps: withoutUndefined(restoreProps(spec.props, {})),
    // `restoreProps` yields exactly the keys of `P`; TypeScript cannot follow a mapped type through a loop.

    parseProps: (raw) => restoreProps(spec.props, raw) as PropsOf<P>,
  };
}
