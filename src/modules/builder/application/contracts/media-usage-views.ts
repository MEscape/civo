/** One saved page that shows a file, with the components on it that do. */
export interface MediaPageUseView {
  readonly pageId: string;
  readonly title: string;
  readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
}

export interface MediaUsageView {
  /** The pages that show each file, by file id; a file no page shows is absent. */
  readonly byAsset: Readonly<Record<string, readonly MediaPageUseView[]>>;
  /** True when the website has more pages than one read covers: the answer is then from its first pages. */
  readonly isTruncated: boolean;
}
