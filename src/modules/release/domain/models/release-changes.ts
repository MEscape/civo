export type PageChangeKind = 'added' | 'changed' | 'removed';

export interface PageChange {
  /** The root page has an empty path. */
  readonly path: string;
  readonly title: string;
  readonly kind: PageChangeKind;
}

/** What a release changed against the one live before it. Frozen when it is published. */
export interface ReleaseChanges {
  /** Ordered by path. */
  readonly pageChanges: readonly PageChange[];
  /** Name, address or description differ from the earlier release. */
  readonly websiteChanged: boolean;
  readonly themeChanged: boolean;
}

/** The most a person may write about a release. */
export const RELEASE_NOTE_MAX_LENGTH = 200;

/** A note as stored: trimmed, and `null` when nothing is left. */
export function normalizeReleaseNote(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  return trimmed === '' ? null : trimmed.slice(0, RELEASE_NOTE_MAX_LENGTH);
}
