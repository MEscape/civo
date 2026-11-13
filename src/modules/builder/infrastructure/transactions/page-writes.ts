import type { TenantId } from '@modules/auth';

import { dateToInstant, db, retryTransient } from '@lib/db';

import { INITIAL_PAGE_VERSION, PAGE_REVISION_LIMIT } from '../../domain/models/page';
import { serializePageConfig } from '../../domain/models/page-config';
import {
  PAGE_SUMMARY_SELECT,
  PUBLISHED_STATUS,
  SAVED_REVISION_SELECT,
} from '../prisma/page-record-mapper';

import type { PageId } from '../../domain/models/ids';
import type { PageDraft } from '../../domain/models/page';
import type { PageConfig } from '../../domain/models/page-config';
import type { PageSummaryRecord, SavedRevisionRecord } from '../prisma/page-record-mapper';

/**
 * Stores a new page and its first revision in one transaction, so a page never exists without a
 * configuration. `null`: the website is not one of the tenant (another tenant's website is simply
 * absent). A taken path surfaces as the database's unique violation, which the repository maps.
 * Retried as a whole when the database aborts it as a deadlock or serialization failure.
 */
export function insertPage(
  tenantId: TenantId,
  draft: PageDraft,
): Promise<PageSummaryRecord | null> {
  return retryTransient(() =>
    db.transaction(async (tx) => {
      // Resolved by (id, tenantId): another tenant's website is simply "not found".
      const website = await tx.orm.public.Website.where({ id: draft.websiteId, tenantId })
        .select('id')
        .first();
      if (website === null) {
        return null;
      }

      const page = await tx.orm.public.Page.select(...PAGE_SUMMARY_SELECT).create({
        tenantId,
        websiteId: draft.websiteId,
        path: draft.path,
        title: draft.title,
        version: INITIAL_PAGE_VERSION,
      });
      // @owner-scope child The revision of the page created just above, under the same tenant.
      await tx.orm.public.PageConfig.create({
        pageId: page.id,
        version: INITIAL_PAGE_VERSION,
        content: serializePageConfig(draft.config),
        status: PUBLISHED_STATUS,
      });
      return page;
    }),
  );
}

export interface RevisionWrite {
  readonly id: PageId;
  readonly tenantId: TenantId;
  readonly config: PageConfig;
  /** The revision the editor loaded; the write only happens while it is still the stored one. */
  readonly expectedVersion: number;
  readonly savedAt: Date;
}

/**
 * Stores a new revision against `expectedVersion` in one transaction. The version in `where` is
 * the compare-and-swap: ONE `UPDATE … WHERE`, so a stale editor matches no row and a competing
 * save cannot pass the check. `null`: no row matched (the page is gone or the editor is stale).
 * The revision rows are written and pruned in the same transaction as the version bump.
 */
export function writeRevision(write: RevisionWrite): Promise<SavedRevisionRecord | null> {
  const { id, tenantId, config, expectedVersion, savedAt } = write;
  const nextVersion = expectedVersion + 1;

  return retryTransient(() =>
    db.transaction(async (tx) => {
      const won = await tx.orm.public.Page.where({
        id,
        tenantId,
        version: expectedVersion,
      }).updateAndCount({ version: nextVersion, updatedAt: dateToInstant(savedAt) });
      if (won === 0) {
        return null;
      }
      const revision = await tx.orm.public.Page.where({ id, tenantId })
        .select(...SAVED_REVISION_SELECT)
        .first();
      if (revision === null) {
        return null;
      }

      // @owner-scope child The revision of the page updated just above, which is pinned to the tenant.
      await tx.orm.public.PageConfig.create({
        pageId: id,
        version: nextVersion,
        content: serializePageConfig(config),
        status: PUBLISHED_STATUS,
      });
      // Revisions are contiguous, so this keeps exactly the newest PAGE_REVISION_LIMIT.
      // @owner-scope child The older revisions of the page updated above.
      await tx.orm.public.PageConfig.where({ pageId: id })
        .where((revisionRow) => revisionRow.version.lte(nextVersion - PAGE_REVISION_LIMIT))
        .deleteAndCount();
      return revision;
    }),
  );
}
