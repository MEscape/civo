import type { Clock } from '@lib/clock';
import type { ConflictAppError, NotFoundAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import type { ObjectStore } from '@lib/storage';

import type { MediaAccess, MediaAccessError } from '../domain/ports/media-access.port';
import type { MediaAssetRepository } from '../domain/ports/media-asset.repository';
import type { MediaAuditLog } from '../domain/ports/media-audit-log.port';
import type { MediaUsageRepository } from '../domain/ports/media-usage.repository';

/** What every protected media use case is built from. */
export interface MediaDependencies {
  readonly access: MediaAccess;
  readonly assets: MediaAssetRepository;
  readonly usage: MediaUsageRepository;
  readonly audit: MediaAuditLog;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly store: ObjectStore;
}

/** Everything an operation on one website's files can fail with. */
export type MediaOperationError =
  MediaAccessError | NotFoundAppError | ConflictAppError | RateLimitedAppError;
