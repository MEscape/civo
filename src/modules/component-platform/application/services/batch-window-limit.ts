import type { ContentKind } from '../../domain/content/content-definitions';
import type { ContentBatch } from '../../domain/ports/content-source.port';

/** A combined view must respect every contributing source's declared request budget. */
export function batchWindowLimit<K extends ContentKind>(
  batches: ReadonlyArray<ContentBatch<K>>,
): number | undefined {
  const limits = batches.flatMap((batch) =>
    batch.maxWindowRecords === undefined ? [] : [batch.maxWindowRecords],
  );
  return limits.length === 0 ? undefined : Math.min(...limits);
}
