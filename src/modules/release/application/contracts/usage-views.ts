/** A live release that uses a given component type. */
export interface ComponentUsageView {
  readonly websiteId: string;
  readonly releaseId: string;
  readonly componentVersion: number;
}

/** The live pages that show each dataset, by dataset id; a dataset the live site does not show is absent. */
export type LiveDatasetUsageView = Readonly<
  Record<string, ReadonlyArray<{ readonly path: string; readonly title: string }>>
>;

/** The live pages that place each saved map, by map id; a map the live site does not place is absent. */
export type LiveMapUsageView = LiveDatasetUsageView;
