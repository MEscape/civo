/**
 * The category values the editor offers for a `category` control: what the
 * page's bound datasets actually contain, plus the values of the sample data
 * a component shows while nothing is bound. The route builds it from the
 * component platform; the builder only displays it.
 */
export interface CategoryOptionsDto {
  /** Distinct category values per dataset id, already sorted. */
  readonly byDataset: Readonly<Record<string, readonly string[]>>;
  /** The sample data's category values per content kind. */
  readonly sampleByKind: Readonly<Record<string, readonly string[]>>;
}

export const NO_CATEGORY_OPTIONS: CategoryOptionsDto = { byDataset: {}, sampleByKind: {} };
