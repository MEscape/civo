import type { TenantId } from '@modules/auth';

import { createPersistenceFailures, db } from '@lib/db';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  UnexpectedAppError,
} from '@lib/errors';
import { logger } from '@lib/logger';
import { offsetOf, toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  RELEASE_ERROR_CODES,
  releaseNotFound,
  releaseNumberConflict,
} from '../../domain/errors/release-errors';
import { toReleaseId, toWebsiteId } from '../../domain/models/ids';
import { hashStoredSnapshot } from '../hashing/snapshot-hash';
import { activateRelease, insertRelease } from '../transactions/release-writes';

import {
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
  ReleaseNeighbours,
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
 * Publish and restore take the same website lock; transient failures retry the whole transaction.
 */
export class PrismaReleaseRepository implements ReleaseRepository {
  findHistory(
    websiteId: WebsiteId,
    page: PageRequest,
  ): AppResultAsync<ReleaseHistory, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const website = await db.orm.public.Website.where({ id: websiteId })
        .select('publishedReleaseId')
        .first();
      const total = await db.orm.public.WebsiteRelease.where({ websiteId }).aggregate(
        (aggregate) => ({ total: aggregate.count() }),
      );
      const records = await db.orm.public.WebsiteRelease.where({ websiteId })
        .select(...RELEASE_SUMMARY_SELECT)
        // The release number is unique per website, so the order is stable.
        .orderBy([(r) => r.releaseNumber.desc()])
        .limit(page.pageSize)
        .offset(offsetOf(page))
        .all();
      return { website, records, total: total.total };
    }, failures.infraOnly('findHistory')).map(({ website, records, total }) => {
      const activeId = website?.publishedReleaseId ?? null;
      return {
        ...toPage(records.map(toReleaseSummary), total, page),
        activeReleaseId: activeId === null ? null : toReleaseId(activeId),
      };
    });
  }

  findNeighbours(
    websiteId: WebsiteId,
    releaseNumber: number,
  ): AppResultAsync<ReleaseNeighbours, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const website = await db.orm.public.Website.where({ id: websiteId })
        .select('publishedReleaseId')
        .first();
      const older = await db.orm.public.WebsiteRelease.where({ websiteId })
        .where((r) => r.releaseNumber.lt(releaseNumber))
        .select('id', 'releaseNumber')
        .orderBy([(r) => r.releaseNumber.desc()])
        .first();
      const newer = await db.orm.public.WebsiteRelease.where({ websiteId })
        .where((r) => r.releaseNumber.gt(releaseNumber))
        .select('id', 'releaseNumber')
        .orderBy([(r) => r.releaseNumber.asc()])
        .first();
      return { website, older, newer };
    }, failures.infraOnly('findNeighbours')).map(({ website, older, newer }) => {
      const toRef = (row: { id: string; releaseNumber: number } | null) =>
        row === null ? null : { id: toReleaseId(row.id), releaseNumber: row.releaseNumber };
      const activeId = website?.publishedReleaseId ?? null;
      return {
        activeReleaseId: activeId === null ? null : toReleaseId(activeId),
        older: toRef(older),
        newer: toRef(newer),
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
  ): AppResultAsync<
    { readonly items: readonly PublishedDependencies[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Website.where({ tenantId })
          // Filtered and bounded in the database: only live websites, at most `limit` of them.
          .where((w) => w.publishedReleaseId.isNotNull())
          .select('id', 'publishedReleaseId')
          .include('publishedRelease', (r) => r.select('id', 'snapshot'))
          .orderBy([(w) => w.id.asc()])
          .limit(limit + 1)
          .all(),
      failures.infraOnly('listPublishedDependencies'),
    ).map((websites) => {
      const shown = websites.slice(0, limit);
      const items = shown.flatMap((website) => {
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
      });
      return { items, isTruncated: websites.length > limit || items.length < shown.length };
    });
  }

  publish(
    input: NewRelease,
  ): AppResultAsync<ReleaseSummary, ConflictAppError | InfrastructureAppError> {
    const { snapshot, changes, ...rest } = input;
    const stored = toStoredSnapshot(snapshot);

    return fromThrowableAsync(
      () =>
        insertRelease({
          ...rest,
          snapshot: stored,
          snapshotHash: hashStoredSnapshot(stored),
          changes,
        }),
      failures.orConflict('publish', releaseNumberConflict),
    ).map(toReleaseSummary);
  }

  activate(input: {
    readonly websiteId: WebsiteId;
    readonly releaseId: ReleaseId;
  }): AppResultAsync<Activation, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      () => activateRelease(input.websiteId, input.releaseId),
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
