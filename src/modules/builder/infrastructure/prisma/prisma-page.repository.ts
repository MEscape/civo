import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures, dateToInstant } from '@lib/db';
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
  BUILDER_ERROR_CODES,
  pageNotFound,
  pagePathTaken,
  pageVersionConflict,
  websiteNotFound,
} from '../../domain/errors/builder-errors';
import { INITIAL_PAGE_VERSION, PAGE_REVISION_LIMIT } from '../../domain/models/page';
import { serializePageConfig } from '../../domain/models/page-config';

import {
  PAGE_CONFIG_SELECT,
  PAGE_SUMMARY_SELECT,
  PUBLISHED_STATUS,
  SAVED_REVISION_SELECT,
  toCreatedPage,
  toNullablePage,
  toPageSummary,
  toReleasePage,
  toSavedRevision,
} from './page-record-mapper';

import type { PageRecord } from './page-record-mapper';
import type { PageId, WebsiteId } from '../../domain/models/ids';
import type { Page, PageSummary } from '../../domain/models/page';
import type { SavedRevision } from '../../domain/models/page-revision';
import type { ReleasePage } from '../../domain/models/release-page';
import type {
  NewPage,
  PageReadError,
  PageRepository,
  SavePageConfigInput,
} from '../../domain/ports/page.repository';

const MODULE = 'builder.persistence';

const failures = createPersistenceFailures({
  module: MODULE,
  code: BUILDER_ERROR_CODES.persistenceFailed,
  subject: 'Page',
});

const persistenceLogger = logger.withContext({ module: MODULE });

/** Pages of every website with only the newest revision's JSON: never the whole history. */
const pagesWithLatestConfig = () =>
  db.orm.public.Page.select(...PAGE_SUMMARY_SELECT).include('configs', (configs) =>
    configs
      .select(...PAGE_CONFIG_SELECT)
      .orderBy([(config) => config.version.desc()])
      .limit(1),
  );

/**
 * A read that fails closed on a damaged page is an anomaly operations
 * must see, so it is logged here, where it is detected, with ids only.
 */
function restore(record: PageRecord | null): AppResultAsync<Page | null, UnexpectedAppError> {
  const restored = toNullablePage(record);
  if (restored.isErr() && record !== null) {
    persistenceLogger.error('page.config_corrupted', {
      pageId: record.id,
      websiteId: record.websiteId,
    });
  }
  return restored.isOk() ? okAsync(restored.value) : errAsync(restored.error);
}

function toReleasePages(records: readonly PageRecord[]): readonly ReleasePage[] {
  return records.map((record) => {
    const page = toReleasePage(record);
    if (page.state.status === 'config_invalid') {
      persistenceLogger.warn('page.config_corrupted', {
        pageId: record.id,
        websiteId: record.websiteId,
      });
    }
    return page;
  });
}

type SaveConfigError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Prisma 8 repository for pages and their revisions: the only place that
 * touches `db` for them.
 *
 * - Query results are awaitable but not `Promise`s, so each thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * - Multi-statement writes run in one transaction aligned with the use case.
 *
 * Failure conventions (see `createPersistenceFailures`):
 * - reads -> `infraOnly`
 * - writes that can hit a unique constraint -> `orConflict`
 * - single-row writes -> `requireRow` (Prisma 8 `update()` resolves to
 *   `null` on a miss, which is also how a stale revision shows up)
 *
 * The clock is injected so a save's timestamp is testable; `updatedAt` has
 * no `@updatedAt` in the schema, so every write sets it.
 */
export class PrismaPageRepository implements PageRepository {
  constructor(private readonly clock: Clock) {}

  findById(id: PageId, tenantId: TenantId): AppResultAsync<Page | null, PageReadError> {
    return fromThrowableAsync(
      async () => pagesWithLatestConfig().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).andThen(restore);
  }

  findSummaryById(
    id: PageId,
    tenantId: TenantId,
  ): AppResultAsync<PageSummary | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Page.where({ id, tenantId })
          .select(...PAGE_SUMMARY_SELECT)
          .first(),
      failures.infraOnly('findSummaryById'),
    ).map((record) => record && toPageSummary(record));
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly PageSummary[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Page.where({ websiteId, tenantId })
          .select(...PAGE_SUMMARY_SELECT)
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(page) => page.createdAt.asc(), (page) => page.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).map((records) => records.map(toPageSummary));
  }

  listReleasePages(
    websiteId: WebsiteId,
    limit: number,
  ): AppResultAsync<readonly ReleasePage[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        pagesWithLatestConfig()
          .where({ websiteId })
          .orderBy([(page) => page.path.asc(), (page) => page.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listReleasePages'),
    ).map(toReleasePages);
  }

  create(
    input: NewPage,
  ): AppResultAsync<Page, NotFoundAppError | ConflictAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;

    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          // Resolved by (id, tenantId): another tenant's website is simply "not found".
          const website = await tx.orm.public.Website.where({
            id: draft.websiteId,
            tenantId,
          })
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
          await tx.orm.public.PageConfig.create({
            pageId: page.id,
            version: INITIAL_PAGE_VERSION,
            content: serializePageConfig(draft.config),
            status: PUBLISHED_STATUS,
          });
          return page;
        }),
      failures.orConflict('create', pagePathTaken),
    )
      .andThen(failures.requireRow(websiteNotFound))
      .map((record) => toCreatedPage(record, draft.config));
  }

  saveConfig(input: SavePageConfigInput): AppResultAsync<SavedRevision, SaveConfigError> {
    const { id, tenantId, config, expectedVersion } = input;
    const nextVersion = expectedVersion + 1;

    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          // The version in `where` is the compare-and-swap: a stale editor matches no row.
          const revision = await tx.orm.public.Page.where({
            id,
            tenantId,
            version: expectedVersion,
          })
            .select(...SAVED_REVISION_SELECT)
            .update({
              version: nextVersion,
              updatedAt: dateToInstant(this.clock.now()),
            });
          if (revision === null) {
            return null;
          }

          await tx.orm.public.PageConfig.create({
            pageId: id,
            version: nextVersion,
            content: serializePageConfig(config),
            status: PUBLISHED_STATUS,
          });
          // Revisions are contiguous, so this keeps exactly the newest PAGE_REVISION_LIMIT.
          await tx.orm.public.PageConfig.where({ pageId: id })
            .where((revisionRow) => revisionRow.version.lte(nextVersion - PAGE_REVISION_LIMIT))
            .deleteAndCount();
          return revision;
        }),
      failures.infraOnly('saveConfig'),
    )
      .andThen((revision) =>
        revision === null ? this.explainMissingPage(id, tenantId) : okAsync(revision),
      )
      .map(toSavedRevision);
  }

  /**
   * The save matched no row: either the page is gone (or belongs to another
   * tenant) or the editor is stale. One read tells them apart, and only on
   * this failure path.
   */
  private explainMissingPage(
    id: PageId,
    tenantId: TenantId,
  ): AppResultAsync<never, SaveConfigError> {
    return fromThrowableAsync(
      async () => db.orm.public.Page.where({ id, tenantId }).select('id').first(),
      failures.infraOnly('saveConfig.lookup'),
    ).andThen((record) => errAsync(record === null ? pageNotFound() : pageVersionConflict()));
  }
}
