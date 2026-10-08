import type {
  ComponentCategory,
  ContentKind,
  PropControl,
  PropGroup,
} from './component-platform-constraints';

/** Text is referenced by translation key: the catalog is plain data and carries no locale. */
export interface CatalogOptionView {
  readonly value: string | number;
  /**
   * `null` when the value is its own label: the numbers of a `columns`
   * control read the same in every language. Only `select` options are
   * words and have a translation.
   */
  readonly labelKey: string | null;
}

export interface CatalogBoundsView {
  readonly min: number;
  readonly max: number;
}

/** One field of an `items` entry. */
export interface CatalogItemFieldView {
  readonly key: string;
  readonly labelKey: string;
  readonly multiline: boolean;
}

export interface CatalogFieldView {
  readonly key: string;
  readonly control: PropControl;
  readonly group: PropGroup | null;
  readonly labelKey: string;
  readonly placeholderKey: string | null;
  readonly options: readonly CatalogOptionView[];
  /** Limits of a `number` control, so the panel never restates them. */
  readonly bounds: CatalogBoundsView | null;
  /** Which canonical kind a `dataset` control must offer datasets of. */
  readonly canonicalKind: ContentKind | null;
  /** The fields of one entry of an `items` control; empty for every other control. */
  readonly itemFields: readonly CatalogItemFieldView[];
}

export interface CatalogContractView {
  readonly contract: ContentKind;
  readonly minVersion: number;
}

/** A component as the builder's palette and properties panel see it. */
export interface ComponentCatalogEntry {
  readonly type: string;
  readonly version: number;
  readonly category: ComponentCategory;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly canHaveChildren: boolean;
  /** `null`: any component may be nested. */
  readonly acceptsChildTypes: readonly string[] | null;
  readonly fields: readonly CatalogFieldView[];
  readonly municipalFields: readonly string[];
  readonly municipallyEditable: boolean;
  readonly dependsOnContracts: readonly CatalogContractView[];
  /** What a freshly inserted node looks like. The builder adds the id. */
  readonly blueprint: {
    readonly type: string;
    readonly props: Readonly<Record<string, unknown>>;
  };
}

export interface ComponentCatalogView {
  readonly components: readonly ComponentCatalogEntry[];
}

export interface ReleaseContractView extends CatalogContractView {
  /** The version in force right now; a release is blocked when it is below `minVersion`. */
  readonly currentVersion: number;
}

/** What a release pins and checks for one component. */
export interface ComponentReleaseInfo {
  readonly version: number;
  readonly dependsOnContracts: readonly ReleaseContractView[];
}
