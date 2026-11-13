/** One saved page that places a map, with the components on it that do. */
export interface MapPageUseView {
  readonly pageId: string;
  readonly title: string;
  /** The map components placing it, each opened in the editor by its node id. */
  readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
}

/** A map component on a saved page with no saved map chosen yet. */
export interface MapAwaitingView {
  readonly pageId: string;
  readonly title: string;
  readonly nodeId: string;
  readonly type: string;
}

export interface MapUsageView {
  /** The pages that place each saved map, by map id; a map no page places is absent. */
  readonly byMap: Readonly<Record<string, readonly MapPageUseView[]>>;
  /** Map components still waiting for a saved map, in page order: where a new map goes next. */
  readonly awaiting: readonly MapAwaitingView[];
  /** True when the website has more pages than one read covers: the answer is then from its first pages. */
  readonly isTruncated: boolean;
}
