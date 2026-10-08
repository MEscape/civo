import type { CanonicalKind, MappedRecordsView } from '@modules/data-sources';

import type { AppError } from '@lib/errors';
import { logger } from '@lib/logger';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { getContentDefinition } from '../../domain/content/content-definitions';
import {
  contentDatasetKindMismatch,
  contentDatasetNotFound,
  contentDatasetNotMapped,
  contentSourceFailed,
} from '../../domain/errors/component-platform-errors';

import { normalizeInstants } from './normalize-instants';

import type { ContentKind, ContentOf } from '../../domain/content/content-definitions';
import type {
  ContentBatch,
  ContentRequest,
  ContentSource,
  ContentSourceError,
} from '../../domain/ports/content-source.port';

/**
 * The one thing this adapter needs from the data-sources module. The answer
 * type is data-sources' own `MappedRecordsView`, imported, not restated: when
 * that view changes, this adapter stops compiling instead of silently drifting.
 * `composition.ts` passes the real function in.
 */
export type FetchMappedRecords = (
  datasetId: string,
  websiteId: string,
) => AppResultAsync<MappedRecordsView>;

const sourceLogger = logger.withContext({ module: 'component-platform.dataset-source' });

/**
 * Anti-corruption boundary: data-sources' failures become this module's own
 * kinds. A malformed id is "not found", the policy data-sources itself
 * follows, so nothing is revealed about which ids exist.
 */
function toSourceError(error: AppError): ContentSourceError {
  switch (error.kind) {
    case 'not_found':
    case 'validation':
      sourceLogger.warn('Dataset is not available', { code: error.code });
      return contentDatasetNotFound();
    case 'conflict':
      sourceLogger.warn('Dataset is not mapped yet', { code: error.code });
      return contentDatasetNotMapped();
    default:
      // Logged once, here, where the failure is translated; callers only see the mapped kind.
      sourceLogger.error('Dataset source failed', error, { code: error.code });
      return contentSourceFailed(error);
  }
}

/**
 * Compile-time proof that every kind this module renders exists in
 * data-sources. One direction only: a kind data-sources adds needs nothing
 * here until a component renders it, while a kind it removes or renames
 * stops this file compiling, which is exactly when this adapter must change.
 */
function toCanonicalKind(kind: ContentKind): CanonicalKind {
  return kind;
}

function mismatch(expected: ContentKind, view: MappedRecordsView): ContentSourceError {
  sourceLogger.warn('Dataset provides another kind than the component renders', {
    expected,
    actual: view.canonicalKind,
  });
  return contentDatasetKindMismatch();
}

function validate<K extends ContentKind>(
  kind: K,
  view: MappedRecordsView,
  datasetId: string,
): ContentBatch<K> {
  const definition = getContentDefinition(kind);
  const items: Array<ContentOf<K>> = [];
  let rejected = 0;

  for (const record of view.records) {
    // The record id is authoritative: a mapped field named `id` must not override it.
    const candidate = {
      ...normalizeInstants(record.values, definition.instantFields),
      id: record.id,
    };
    const parsed = definition.parse(candidate);
    if (parsed.isOk()) {
      items.push(parsed.value);
    } else {
      rejected += 1;
    }
  }

  if (rejected > 0 || view.skipped > 0 || view.truncated) {
    sourceLogger.warn('Dataset records were dropped or truncated', {
      datasetId,
      kind,
      rejected,
      skipped: view.skipped,
      truncated: view.truncated,
    });
  }
  return { items };
}

/**
 * Serves canonical records from a bound dataset. The mapping engine hands
 * over UNVALIDATED values; this adapter is where they meet the canonical
 * contract, and a record that fails it is dropped and counted, never shown.
 */
export class DatasetContentSource implements ContentSource {
  constructor(private readonly fetchRecords: FetchMappedRecords) {}

  list<K extends ContentKind>(
    request: ContentRequest<K>,
  ): AppResultAsync<ContentBatch<K>, ContentSourceError> {
    return this.fetchRecords(request.datasetId, request.websiteId)
      .mapErr(toSourceError)
      .andThen((view): AppResultAsync<ContentBatch<K>, ContentSourceError> =>
        view.canonicalKind === toCanonicalKind(request.kind)
          ? okAsync(validate(request.kind, view, request.datasetId))
          : errAsync(mismatch(request.kind, view)),
      );
  }
}
