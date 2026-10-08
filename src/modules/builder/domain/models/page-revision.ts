/** The outcome of a successful save: which revision now holds the draft. */
export interface SavedRevision {
  readonly version: number;
  readonly savedAt: Date;
}
