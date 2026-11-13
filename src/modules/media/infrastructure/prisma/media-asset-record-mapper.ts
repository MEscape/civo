import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import { infrastructureError } from '@lib/errors';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { MEDIA_ERROR_CODES } from '../../domain/errors/media-errors';
import { toMediaAssetId } from '../../domain/models/ids';
import { isMediaFormat } from '../../domain/models/media-format';

import type { MediaAsset, MediaStatus, MediaVisibility } from '../../domain/models/media-asset';

/**
 * Persistence shapes. Generated Prisma contract types never leave the persistence layer.
 *
 * Field list for `.select(...)`: Prisma 8 takes field names as separate arguments, so it is
 * spread at the call site: `.select(...MEDIA_SELECT)`.
 */
export const MEDIA_SELECT = [
  'id',
  'tenantId',
  'objectKey',
  'originalFilename',
  'contentType',
  'byteSize',
  'visibility',
  'status',
  'createdBy',
  'uploadExpiresAt',
  'createdAt',
  'updatedAt',
] as const;

export interface MediaAssetRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly objectKey: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly visibility: string;
  readonly status: string;
  readonly createdBy: string;
  readonly uploadExpiresAt: InstantRecord;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

type StoredVisibility = 'PUBLIC' | 'PRIVATE';

const VISIBILITY_TO_STORED = { public: 'PUBLIC', private: 'PRIVATE' } as const satisfies Record<
  MediaVisibility,
  StoredVisibility
>;

export function toStoredVisibility(visibility: MediaVisibility): StoredVisibility {
  return VISIBILITY_TO_STORED[visibility];
}

const VISIBILITY_FROM_STORED: Readonly<Record<string, MediaVisibility | undefined>> = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

const STATUS_FROM_STORED: Readonly<Record<string, MediaStatus | undefined>> = {
  PENDING: 'pending',
  READY: 'ready',
  DELETING: 'deleting',
};

function unreadable(what: string, value: string): InfrastructureAppError {
  return infrastructureError(
    MEDIA_ERROR_CODES.persistenceFailed,
    `A stored file has a ${what} this module does not know: "${value}".`,
  );
}

/**
 * A stored value outside the vocabulary means the table was written by something other than
 * this module. It is refused loudly, as a persistence failure, instead of being served as if
 * it were valid.
 */
export function toMediaAsset(
  record: MediaAssetRecord,
): AppResult<MediaAsset, InfrastructureAppError> {
  const visibility = VISIBILITY_FROM_STORED[record.visibility];
  const status = STATUS_FROM_STORED[record.status];
  if (!isMediaFormat(record.contentType)) {
    return err(unreadable('content type', record.contentType));
  }
  if (visibility === undefined) {
    return err(unreadable('visibility', record.visibility));
  }
  if (status === undefined) {
    return err(unreadable('status', record.status));
  }

  return ok({
    id: toMediaAssetId(record.id),
    tenantId: toTenantId(record.tenantId),
    objectKey: record.objectKey,
    originalFilename: record.originalFilename,
    contentType: record.contentType,
    byteSize: record.byteSize,
    visibility,
    status,
    createdBy: record.createdBy,
    uploadExpiresAt: instantToDate(record.uploadExpiresAt),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  });
}
