import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ContentKind, ContentOf } from '../content/content-definitions';
import type { DatasetId, WebsiteId } from '../models/ids';

/** Why a source could not deliver: all three are outcomes callers can tell apart. */
export type ContentSourceError = NotFoundAppError | ConflictAppError | InfrastructureAppError;

export interface ContentRequest<K extends ContentKind> {
  readonly kind: K;
  readonly datasetId: DatasetId;
  /** From the render context, never from component props: the dataset must belong to this website. */
  readonly websiteId: WebsiteId;
}

export interface ContentBatch<K extends ContentKind> {
  /** Only records that satisfy the canonical contract. Rejected records are the adapter's to report. */
  readonly items: ReadonlyArray<ContentOf<K>>;
}

/**
 * Delivers canonical records from a bound dataset. Adapters translate every
 * transport failure into this module's own error kinds and never return a
 * record that failed its contract.
 */
export interface ContentSource {
  list<K extends ContentKind>(
    request: ContentRequest<K>,
  ): AppResultAsync<ContentBatch<K>, ContentSourceError>;
}
