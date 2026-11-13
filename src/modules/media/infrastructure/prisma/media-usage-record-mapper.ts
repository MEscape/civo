/**
 * The shape of the usage query's one result row, and what it means.
 *
 * `referenced` is the text `'true'` or `'false'` (a boolean cast to text, so no driver codec
 * decides how it is delivered).
 */
interface MediaUsageRecord {
  readonly referenced: string;
}

/**
 * Anything but a clear "no" counts as in use. A missing row or an unexpected value must never
 * read as "unused": that answer deletes files a published page may still show.
 */
export function isReferencedFrom(record: MediaUsageRecord | undefined): boolean {
  return record?.referenced !== 'false';
}
