import { advisoryLock, dateToInstant, db, retryTransient, toJsonValue } from '@lib/db';
import type { Transaction } from '@lib/db';

import { nextReleaseNumber } from '../../domain/models/release';
import { RECORD_STATUS, RELEASE_SUMMARY_SELECT } from '../prisma/release-record-mapper';

import type { ReleaseId, WebsiteId } from '../../domain/models/ids';
import type { ReleaseSummaryRecord, StoredReleaseSnapshot } from '../prisma/release-record-mapper';

/** Publishing and restoring share this lock, so a website's live release changes one write at a time. */
async function lockWebsiteReleases(tx: Transaction, websiteId: WebsiteId): Promise<void> {
  await advisoryLock(tx, `release:${websiteId}`);
}

export interface ReleaseWrite {
  readonly websiteId: WebsiteId;
  readonly snapshot: StoredReleaseSnapshot;
  readonly snapshotHash: string;
  readonly note: string | null;
  readonly changes: Parameters<typeof toJsonValue>[0];
  readonly publishedBy: string | null;
  readonly publishedAt: Date;
}

/**
 * Stores the next release of a website and points the website at it, in one transaction. The
 * unique (websiteId, releaseNumber) constraint turns a concurrent publish into a conflict
 * instead of two releases sharing a number; the repository maps that. Retried as a whole when
 * the database aborts it as a deadlock or serialization failure.
 */
export function insertRelease(write: ReleaseWrite): Promise<ReleaseSummaryRecord> {
  const { websiteId, snapshot, snapshotHash, note, changes, publishedBy, publishedAt } = write;

  return retryTransient(() =>
    db.transaction(async (tx) => {
      await lockWebsiteReleases(tx, websiteId);
      const latest = await tx.orm.public.WebsiteRelease.where({ websiteId })
        .select('releaseNumber')
        .orderBy([(r) => r.releaseNumber.desc()])
        .first();

      const created = await tx.orm.public.WebsiteRelease.select(...RELEASE_SUMMARY_SELECT).create({
        websiteId,
        releaseNumber: nextReleaseNumber(latest?.releaseNumber ?? null),
        status: RECORD_STATUS.published,
        snapshot: toJsonValue(snapshot),
        snapshotHash,
        note,
        changes: toJsonValue(changes),
        publishedBy,
        // Prisma 8 does not accept a `Date` for a `DateTime` column.
        publishedAt: dateToInstant(publishedAt),
      });

      await tx.orm.public.Website.where({ id: websiteId }).update({
        publishedReleaseId: created.id,
      });

      return created;
    }),
  );
}

/** What a restore changed: the release now live, and the one it replaced. */
export interface ActivationRecord {
  readonly activated: ReleaseSummaryRecord;
  readonly previous: string | null;
}

/**
 * Makes an earlier release the live one, in one transaction under the website's release lock.
 * `null`: the release is not this website's, and the live one is left alone (nothing has been
 * written yet). The replaced release's snapshot is never touched; it only becomes history.
 */
export function activateRelease(
  websiteId: WebsiteId,
  releaseId: ReleaseId,
): Promise<ActivationRecord | null> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      await lockWebsiteReleases(tx, websiteId);
      const website = await tx.orm.public.Website.where({ id: websiteId })
        .select('publishedReleaseId')
        .first();
      const previous = website?.publishedReleaseId ?? null;

      const activated = await tx.orm.public.WebsiteRelease.where({ id: releaseId, websiteId })
        .select(...RELEASE_SUMMARY_SELECT)
        .update({ status: RECORD_STATUS.published });
      if (!activated) {
        return null;
      }

      if (previous !== null && previous !== releaseId) {
        await tx.orm.public.WebsiteRelease.where({ id: previous, websiteId }).update({
          status: RECORD_STATUS.rolled_back,
        });
      }

      await tx.orm.public.Website.where({ id: websiteId }).update({
        publishedReleaseId: releaseId,
      });

      return { activated, previous };
    }),
  );
}
