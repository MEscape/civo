import { randomUUID } from 'node:crypto';

import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { combine, combineAsync, errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import { MEDIA_ERROR_CODES, mediaTooManyPending } from '../../domain/errors/media-errors';
import { toMediaAssetId } from '../../domain/models/ids';
import { mediaObjectKey } from '../../domain/models/media-asset';
import { DEFAULT_MEDIA_SORT } from '../../domain/ports/media-asset.repository';
import { insertPendingWithinQuota } from '../transactions/pending-upload-writes';

import { MEDIA_SELECT, toMediaAsset, toStoredVisibility } from './media-asset-record-mapper';

import type { MediaAssetRecord } from './media-asset-record-mapper';
import type { MediaAssetId } from '../../domain/models/ids';
import type { MediaAsset } from '../../domain/models/media-asset';
import type {
  AbandonedClaim,
  MediaListFilter,
  MediaAssetRepository,
  NewPendingAsset,
  PendingQuota,
} from '../../domain/ports/media-asset.repository';

const failures = createPersistenceFailures({
  module: 'media.persistence',
  code: MEDIA_ERROR_CODES.persistenceFailed,
  subject: 'Media',
});

/** @owner-scope builder Every caller pins it to a tenant before it runs. */
const assetQuery = () => db.orm.public.MediaAsset.select(...MEDIA_SELECT);

/** `%`, `_` and `\` in what a person typed match themselves, not "anything". */
const LIKE_SPECIALS = /[\\%_]/g;

/** The tenant's READY files the filter keeps; every list and its count read the same set. */
function readyAssets(tenantId: TenantId, { visibility, search }: MediaListFilter) {
  let records = db.orm.public.MediaAsset.where({
    tenantId,
    status: 'READY',
    ...(visibility === undefined ? {} : { visibility: toStoredVisibility(visibility) }),
  });
  const text = search?.trim();
  if (text !== undefined && text !== '') {
    const pattern = `%${text.replace(LIKE_SPECIALS, '\\$&')}%`;
    records = records.where((asset) => asset.originalFilename.ilike(pattern));
  }
  return records;
}

/** A row read into the domain; one the module cannot read is a persistence failure. */
function readOne(record: MediaAssetRecord): AppResultAsync<MediaAsset, InfrastructureAppError> {
  const asset = toMediaAsset(record);
  return asset.isOk() ? okAsync(asset.value) : errAsync(asset.error);
}

/** The same for a row that may be absent: absent is an answer, unreadable is a failure. */
function readOptional(
  record: MediaAssetRecord | null,
): AppResultAsync<MediaAsset | null, InfrastructureAppError> {
  return record === null ? okAsync(null) : readOne(record);
}

/**
 * Prisma 8 repository for uploaded files.
 *
 * - Query results are awaitable but not `Promise`s, so each thunk is `async` and returns the
 *   query directly.
 * - Compare-and-swap writes are one `UPDATE … WHERE` through `updateAndCount`; a count of 0 means
 *   the row was gone or no longer in the expected state, and that is the answer, not an error.
 */
export class PrismaMediaAssetRepository implements MediaAssetRepository {
  createPending(
    input: NewPendingAsset,
    quota: PendingQuota,
  ): AppResultAsync<MediaAsset, ConflictAppError | InfrastructureAppError> {
    // The id is minted here and the key derived from it and the tenant: no client value reaches a key.
    const id = randomUUID();
    const objectKey = mediaObjectKey(input.tenantId, toMediaAssetId(id));

    return fromThrowableAsync(
      () => insertPendingWithinQuota({ ...input, id, objectKey }, quota),
      failures.infraOnly('createPending'),
    ).andThen((record): AppResultAsync<MediaAsset, ConflictAppError | InfrastructureAppError> =>
      record === null ? errAsync(mediaTooManyPending()) : readOne(record),
    );
  }

  findById(
    id: MediaAssetId,
    tenantId: TenantId,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => assetQuery().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).andThen(readOptional);
  }

  markReady(
    id: MediaAssetId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        // ONE statement with the status in its WHERE: only the writer that still finds PENDING
        // changes the row, so two finalisations, or one racing a delete, cannot both win.
        assetQuery()
          .where({ id, tenantId, status: 'PENDING' })
          .updateAndCount({ status: 'READY', updatedAt: dateToInstant(now) }),
      failures.infraOnly('markReady'),
    ).andThen((won) => (won === 0 ? okAsync(null) : this.findById(id, tenantId)));
  }

  markDeleting(
    id: MediaAssetId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<MediaAsset | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        assetQuery()
          .where({ id, tenantId })
          .updateAndCount({ status: 'DELETING', updatedAt: dateToInstant(now) }),
      failures.infraOnly('markDeleting'),
    ).andThen((changed) => (changed === 0 ? okAsync(null) : this.findById(id, tenantId)));
  }

  claimAbandoned(claim: AbandonedClaim): AppResultAsync<MediaAsset[], InfrastructureAppError> {
    const { tenantId, now, staleBefore, limit } = claim;
    return fromThrowableAsync(async () => {
      // Claim and mark in ONE statement. SKIP LOCKED lets two simultaneous sweeps take different
      // files instead of waiting for, or both taking, the same ones. The claim is a MATERIALIZED CTE
      // on purpose: as a plain `IN (subquery)` the planner may evaluate the LIMIT once per candidate
      // row and update more files than asked for (seen against a real Postgres).
      const plan = db.raw.sql`
        WITH claimed AS MATERIALIZED (
          SELECT "id" FROM "MediaAsset"
          WHERE "tenantId" = ${tenantId}
            AND (
              ("status" = 'PENDING' AND "uploadExpiresAt" <= ${now.toISOString()}::timestamptz)
              OR ("status" = 'DELETING' AND "updatedAt" <= ${staleBefore.toISOString()}::timestamptz)
            )
          ORDER BY "createdAt"
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "MediaAsset" asset
        SET "status" = 'DELETING', "updatedAt" = ${now.toISOString()}::timestamptz
        FROM claimed
        WHERE asset."id" = claimed."id"
        RETURNING asset."id"::text AS "id"`
        .returnsRow({ id: { codecId: 'pg/text@1', nullable: false } })
        .build();
      const ids: string[] = [];
      for await (const row of db.runtime().query(plan)) {
        ids.push(row.id);
      }
      return ids;
    }, failures.infraOnly('claimAbandoned')).andThen((ids) =>
      combineAsync(ids.map((id) => this.findById(toMediaAssetId(id), tenantId))).map((found) =>
        found.filter(isDefined),
      ),
    );
  }

  listReady(
    tenantId: TenantId,
    page: PageRequest,
    filter: MediaListFilter = {},
  ): AppResultAsync<Page<MediaAsset>, InfrastructureAppError> {
    const { field, direction } = filter.sort ?? DEFAULT_MEDIA_SORT;

    return fromThrowableAsync(async () => {
      const total = await readyAssets(tenantId, filter).aggregate((aggregate) => ({
        total: aggregate.count(),
      }));
      const records = await readyAssets(tenantId, filter)
        .select(...MEDIA_SELECT)
        .orderBy([
          (asset) => {
            const column = field === 'name' ? asset.originalFilename : asset.createdAt;
            return direction === 'asc' ? column.asc() : column.desc();
          },
          // `id` breaks ties so the order is stable between requests.
          (asset) => asset.id.asc(),
        ])
        .limit(page.pageSize)
        .offset(offsetOf(page))
        .all();
      return { records, total: total.total };
    }, failures.infraOnly('listReady')).andThen(({ records, total }) =>
      combine(records.map(toMediaAsset)).match(
        (assets) => okAsync(toPage(assets, total, page)),
        (error) => errAsync(error),
      ),
    );
  }

  deleteById(id: MediaAssetId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.MediaAsset.where({ id, tenantId }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
