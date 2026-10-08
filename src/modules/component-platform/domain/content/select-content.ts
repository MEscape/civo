import { getContentDefinition } from './content-definitions';

import type { ContentKind, ContentOf } from './content-definitions';

export interface ContentSelectionOptions {
  /** Canonical instant; "relevant" is judged against it. */
  readonly now: string;
  /** Matched against the kind's `categoryOf`; `null` keeps every category. */
  readonly category: string | null;
  readonly limit: number;
}

export interface ContentSelection<K extends ContentKind> {
  readonly items: ReadonlyArray<ContentOf<K>>;
  /** More relevant records existed than `limit` allowed. */
  readonly truncated: boolean;
}

/**
 * Applies a kind's own display rules to validated records: drop what is no
 * longer relevant, narrow to one category, order, then bound. The rules live
 * with each contract; this is the one place they are applied.
 */
export function selectContent<K extends ContentKind>(
  kind: K,
  records: ReadonlyArray<ContentOf<K>>,
  options: ContentSelectionOptions,
): ContentSelection<K> {
  const { rule } = getContentDefinition(kind);
  const { now, category, limit } = options;

  const relevant = records.filter((record) => rule.isRelevant?.(record, now) ?? true);
  const matching =
    category === null || rule.categoryOf === undefined
      ? relevant
      : relevant.filter((record) => rule.categoryOf?.(record) === category);
  const ordered = rule.compare === undefined ? matching : [...matching].sort(rule.compare);

  return { items: ordered.slice(0, limit), truncated: ordered.length > limit };
}
