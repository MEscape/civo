import type { PropBounds, PropControl, PropGroup, PropItemField } from './prop-field';
import type { ContentKind } from '../content/content-definitions';

export const COMPONENT_CATEGORIES = ['layout', 'content', 'civic', 'smartcity'] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

/** The oldest contract version a component's rendering code understands. */
export interface ContractDependency {
  readonly contract: ContentKind;
  readonly minVersion: number;
}

/** The editor-facing part of one prop, as the properties panel needs it. */
export interface PropFieldDefinition {
  readonly key: string;
  readonly control: PropControl;
  readonly group: PropGroup | null;
  readonly options: ReadonlyArray<string | number>;
  readonly bounds: PropBounds | null;
  readonly hasPlaceholder: boolean;
  readonly itemFields: readonly PropItemField[];
  /** `null`: a `dataset` prop takes the component's own data binding. */
  readonly datasetKind: ContentKind | null;
}

/**
 * What the platform knows about a component without any UI code: enough for
 * the builder's palette and properties panel, for the release check and for
 * validating stored props. Safe to bundle into the browser.
 *
 * `version` is the implementation version. Bump it when rendering or the
 * prop shape changes in a way an already published release must not pick up
 * silently.
 */
export interface ComponentDefinition<TProps extends object = object> {
  readonly type: string;
  readonly version: number;
  readonly category: ComponentCategory;
  readonly canHaveChildren: boolean;
  /** `null`: any registered component may be nested. */
  readonly acceptsChildTypes: readonly string[] | null;
  readonly fields: readonly PropFieldDefinition[];
  /** Subset of `fields` a municipality admin may edit. */
  readonly municipalFields: readonly string[];
  /** Whether the component is offered in the municipality editor's palette. */
  readonly municipallyEditable: boolean;
  readonly dataBinding: { readonly canonicalKind: ContentKind } | null;
  readonly dependsOnContracts: readonly ContractDependency[];
  /** Props of a freshly inserted node. Derived from the prop fields, so defaults are written once. */
  readonly defaultProps: Readonly<Record<string, unknown>>;
  /**
   * Total: never fails. Invalid or missing props fall back to their default,
   * because a stored page must keep rendering after a prop was tightened.
   */
  parseProps(raw: unknown): TProps;
}
