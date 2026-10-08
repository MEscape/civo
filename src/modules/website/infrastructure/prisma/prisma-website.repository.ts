import type { TenantId } from '@modules/auth';

import { db, createPersistenceFailures } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  WEBSITE_ERROR_CODES,
  websiteNotFound,
  websiteSlugTaken,
} from '../../domain/errors/website-errors';

import {
  THEME_SELECT,
  WEBSITE_SUMMARY_SELECT,
  toThemeData,
  toWebsite,
  toWebsiteSummary,
} from './website-record-mapper';

import type { WebsiteId } from '../../domain/models/ids';
import type { Website, WebsiteChanges, WebsiteSummary } from '../../domain/models/website';
import type { WebsiteTheme } from '../../domain/models/website-theme';
import type { NewWebsite, WebsiteRepository } from '../../domain/ports/website.repository';

const failures = createPersistenceFailures({
  module: 'website.persistence',
  code: WEBSITE_ERROR_CODES.persistenceFailed,
  subject: 'Website',
});

/** Website fields plus its theme, narrowed to what the mapper reads. */
const websiteWithTheme = () =>
  db.orm.public.Website.select(...WEBSITE_SUMMARY_SELECT).include('theme', (theme) =>
    theme.select(...THEME_SELECT),
  );

/**
 * Prisma 8 repository for websites and themes.
 *
 * - Query results are awaitable but not `Promise`s, so each thunk is `async`
 *   and returns the query directly: the async wrapper awaits it.
 * Failure conventions (see `createPersistenceFailures`):
 * - reads and idempotent deletes -> `infraOnly`
 * - writes that can hit a unique constraint (they throw) -> `orConflict`
 * - single-row writes -> `orNotFound` (thrown row-missing) followed by
 *   `requireRow` (Prisma 8 `update()` resolves to `null` on a miss).
 */
export class PrismaWebsiteRepository implements WebsiteRepository {
  findById(
    id: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<Website | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => websiteWithTheme().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && toWebsite(record));
  }

  findBySlug(slug: string): AppResultAsync<Website | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => websiteWithTheme().where({ slug }).first(),
      failures.infraOnly('findBySlug'),
    ).map((record) => record && toWebsite(record));
  }

  listByTenant(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly WebsiteSummary[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.Website.where({ tenantId })
          .select(...WEBSITE_SUMMARY_SELECT)
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(w) => w.updatedAt.desc(), (w) => w.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByTenant'),
    ).map((records) => records.map(toWebsiteSummary));
  }

  create(input: NewWebsite): AppResultAsync<Website, ConflictAppError | InfrastructureAppError> {
    const { tenantId, draft, theme } = input;
    return fromThrowableAsync(
      async () =>
        websiteWithTheme().create({
          tenantId,
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
          templateKey: draft.templateKey,
          theme: (t) => t.create(toThemeData(theme)),
        }),
      failures.orConflict('create', websiteSlugTaken),
    ).map(toWebsite);
  }

  update(
    id: WebsiteId,
    tenantId: TenantId,
    changes: WebsiteChanges,
  ): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () => websiteWithTheme().where({ id, tenantId }).update(changes),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(websiteNotFound))
      .map(toWebsite);
  }

  updateTheme(
    id: WebsiteId,
    tenantId: TenantId,
    theme: WebsiteTheme,
  ): AppResultAsync<Website, NotFoundAppError | InfrastructureAppError> {
    const data = toThemeData(theme);
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const website = await tx.orm.public.Website.where({ id, tenantId })
            .select(...WEBSITE_SUMMARY_SELECT)
            .first();
          if (website === null) {
            return null;
          }

          const themeRow = await tx.orm.public.WebsiteTheme.select(...THEME_SELECT).upsert({
            create: { websiteId: id, ...data },
            update: data,
            conflictOn: { websiteId: id },
          });

          return { ...website, theme: themeRow };
        }),
      failures.infraOnly('updateTheme'),
    )
      .andThen(failures.requireRow(websiteNotFound))
      .map(toWebsite);
  }

  deleteById(id: WebsiteId, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.Website.where({ id, tenantId }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
