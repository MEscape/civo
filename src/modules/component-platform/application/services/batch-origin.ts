import type { ContentKind } from '../../domain/content/content-definitions';
import type { ContentBatch } from '../../domain/ports/content-source.port';
import type { ContentOrigin } from '../contracts/content-views';

/** Retains evidence for every contributing dataset without changing legacy result shapes. */
export function batchOrigin<K extends ContentKind>(
  batches: ReadonlyArray<ContentBatch<K>>,
): ContentOrigin {
  const sources = batches.flatMap((batch) =>
    batch.provenance === undefined ? [] : [batch.provenance],
  );
  const rejected = batches.reduce((count, batch) => count + (batch.rejected ?? 0), 0);
  return sources.length === 0 && rejected === 0
    ? { kind: 'live' }
    : { kind: 'live', sources, rejected };
}
