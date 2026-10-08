import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
} from '@lib/errors';
import { logger } from '@lib/logger';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  RELEASE_ERROR_CODES,
  releaseNotFound,
  releaseNumberConflict,
} from '../../domain/errors/release-errors';
import { toReleaseId, toWebsiteId } from '../../domain/models/ids';
import { nextReleaseNumber } from '../../domain/models/release';
import { hashStoredSnapshot } from '../hashing/snapshot-hash';

import {
  RECORD_STATUS,
  RELEASE_SELECT,
  RELEASE_SUMMARY_SELECT,
  toRelease,
  toReleaseSummary,
  toStoredDependencies,
  toStoredSnapshot,
} from './release-record-mapper';

import type { ReleaseRecord } from './release-record-mapper';
import type { ReleaseId, WebsiteId } from '../../domain/models/ids';
import type { Release, ReleaseHistory, ReleaseSummary } from '../../domain/models/release';
import type {
  Activation,
  NewRelease,
  PublishedDependencies,
  ReleaseReadError,
  ReleaseRepository,
} from '../../domain/ports/release.repository';

const MODULE = 'release.persistence';

const failures = createPersistenceFailures({
  module: MODULE,
  code: RELEASE_ERROR_CODES.persistenceFailed,
  subject: 'Release',
});

const persistenceLogger = logger.withContext({ module: MODULE });

/**
 * A corrupted snapshot is an anomaly operations must see, so it is logged
 * here, where it is detected, with ids only.
 */
function restore(record: ReleaseRecord | null): AppResultAsync<Release | null, UnexpectedAppError> {
  if (record === null) {
    return okAsync(null);
  }

  const restored = toRelease(record);
  if (restored.isErr()) {
    persistenceLogger.error('release.snapshot_corrupted', {
      releaseId: record.id,
      websiteId: record.websiteId,
    });
    return errAsync(restored.error);
  }
  return okAsync(restored.value);
}

/**
 * Prisma-backed release persistence, the only place that touches `db` for
 * releases.
 *
 * Deliberate exception: the live-release pointer is the column
 * `Website.publishedReleaseId`, so publish and activate update the website
 * row inside the same transaction. That is the one write to a table this
 * module does not own; it is what makes the switch atomic.
 *
 * NOTE: like the website repository, this uses the Prisma-client delegate
 * style (`db.websiteRelease.findFirst`, `db.$transaction`, ...). If your
 * client spells queries differently, only the `db.*` expressions in this
 * file change; ports, mappers and use cases do not.
 */
export class PrismaReleaseRepository implements ReleaseRepository {
  findHistory(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<ReleaseHistory, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const website = await db.orm.public.Website.where({ id: websiteId })
        .select('publishedReleaseId')
        .first();
      const records = await db.orm.public.WebsiteRelease.where({ websiteId })
        .select(...RELEASE_SUMMARY_SELECT)
        // The release number is unique per website, so the order is stable.
        .orderBy([(r) => r.releaseNumber.desc()])
        .limit(limit)
        .all();
      return [website, records] as const;
    }, failures.infraOnly('findHistory')).map(([website, records]) => {
      const activeId = website?.publishedReleaseId ?? null;
      return {
        activeReleaseId: activeId === null ? null : toReleaseId(activeId),
        releases: records.map(toReleaseSummary),
      };
    });
  }

  findById(websiteId: WebsiteId, id: ReleaseId): AppResultAsync<Release | null, ReleaseReadError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.WebsiteRelease.where({ id, websiteId })
          .select(...RELEASE_SELECT)
          .first(),
      failures.infraOnly('findById'),
    ).andThen(restore);
  }

  findPublished(websiteId: WebsiteId): AppResultAsync<Release | null, ReleaseReadError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Website.where({ id: websiteId })
          .include('publishedRelease', (r) => r.select(...RELEASE_SELECT))
          .first(),
      failures.infraOnly('findPublished'),
    ).andThen((website) => restore(website?.publishedRelease ?? null));
  }

  listPublishedDependencies(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly PublishedDependencies[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Website.where({ tenantId })
          // Filtered and bounded in the database: only live websites, at most `limit` of them.
          .where((w) => w.publishedReleaseId.isNotNull())
          .select('id', 'publishedReleaseId')
          .include('publishedRelease', (r) => r.select('id', 'snapshot'))
          .orderBy([(w) => w.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listPublishedDependencies'),
    ).map((websites) =>
      websites.flatMap((website) => {
        const release = website.publishedRelease;
        if (release === null) {
          return [];
        }
        const dependencies = toStoredDependencies(release.snapshot);
        if (dependencies === null) {
          return [];
        }

        return [
          {
            websiteId: toWebsiteId(website.id),
            releaseId: toReleaseId(release.id),
            dependencies,
          },
        ];
      }),
    );
  }

  publish(
    input: NewRelease,
  ): AppResultAsync<ReleaseSummary, ConflictAppError | InfrastructureAppError> {
    const { websiteId, snapshot, publishedAt } = input;
    const stored = toStoredSnapshot(snapshot);
    const snapshotHash = hashStoredSnapshot(stored);

    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const latest = await tx.orm.public.WebsiteRelease.where({ websiteId })
            .select('releaseNumber')
            .orderBy([(r) => r.releaseNumber.desc()])
            .first();

          // The unique (websiteId, releaseNumber) constraint turns a
          // concurrent publish into a conflict instead of two releases
          // sharing a number.
          const created = await tx.orm.public.WebsiteRelease.select(
            ...RELEASE_SUMMARY_SELECT,
          ).create({
            websiteId,
            releaseNumber: nextReleaseNumber(latest?.releaseNumber ?? null),
            status: RECORD_STATUS.published,
            snapshot: stored,
            snapshotHash,
            // Prisma 8 does not accept a `Date` for a `DateTime` column.
            publishedAt: dateToInstant(publishedAt),
          });

          await tx.orm.public.Website.where({ id: websiteId }).update({
            publishedReleaseId: created.id,
          });

          return created;
        }),
      failures.orConflict('publish', releaseNumberConflict),
    ).map(toReleaseSummary);
  }

  activate(input: {
    readonly websiteId: WebsiteId;
    readonly releaseId: ReleaseId;
  }): AppResultAsync<Activation, NotFoundAppError | InfrastructureAppError> {
    const { websiteId, releaseId } = input;

    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const website = await tx.orm.public.Website.where({ id: websiteId })
            .select('publishedReleaseId')
            .first();
          const previous = website?.publishedReleaseId ?? null;

          // History only: the replaced release's snapshot is never touched.
          if (previous !== null && previous !== releaseId) {
            await tx.orm.public.WebsiteRelease.where({ id: previous }).update({
              status: RECORD_STATUS.rolled_back,
            });
          }

          const activated = await tx.orm.public.WebsiteRelease.where({ id: releaseId, websiteId })
            .select(...RELEASE_SUMMARY_SELECT)
            .update({
              status: RECORD_STATUS.published,
            });

          if (!activated) {
            return null;
          }

          await tx.orm.public.Website.where({ id: websiteId }).update({
            publishedReleaseId: releaseId,
          });

          return { activated, previous };
        }),
      failures.infraOnly('activate'),
    ).andThen((result) => {
      if (result === null) {
        return errAsync(releaseNotFound());
      }
      const { activated, previous } = result;
      return okAsync({
        release: toReleaseSummary(activated),
        previousReleaseId: previous === null ? null : toReleaseId(previous),
      });
    });
  }
}
