export interface PublishReleaseInput {
  readonly websiteId: string;
  /** What the editor wrote about this release; optional. */
  readonly note?: string | undefined;
}

export interface RollbackReleaseInput {
  readonly websiteId: string;
  readonly releaseId: string;
}

export interface FindWebsitesUsingComponentInput {
  readonly componentType: string;
  /** Narrows to websites pinned to exactly this version. */
  readonly version?: number;
}

/** The page of a history asked for, as the address carries it: untrusted text, resolved by the query. */
export interface HistoryPageOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}
