/** One page that reads a dataset, with the components on it that do. */
export interface DatasetPageUseView {
  readonly pageId: string;
  readonly title: string;
  readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
}

/** A component still showing sample data: its dataset field has nothing chosen. */
export interface ComponentAwaitingDataView {
  readonly pageId: string;
  readonly title: string;
  readonly nodeId: string;
  readonly type: string;
  /** The content kind its dataset field asks for. */
  readonly kind: string;
}

export interface DatasetUsageView {
  /** The pages that read each dataset, by dataset id; a dataset no page reads is absent. */
  readonly byDataset: Readonly<Record<string, readonly DatasetPageUseView[]>>;
  /** Where data could go next, in page order. */
  readonly awaiting: readonly ComponentAwaitingDataView[];
  /** True when the website has more pages than one read covers: the answer is then from its first pages. */
  readonly isTruncated: boolean;
}
