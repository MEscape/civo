import 'server-only';

import { cache } from 'react';
import type { ReactNode } from 'react';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';
import { getComponentPlatformQueries, renderPageNodes } from '@modules/component-platform';

import { systemClock } from '@lib/clock';
import type { UnexpectedAppError } from '@lib/errors';
import { getRateLimiter } from '@lib/rate-limit';
import type { AppResult, AppResultAsync } from '@lib/result';
import { once } from '@lib/utils';

import { CreatePage } from './application/commands/create-page';
import { CreateSystemPage } from './application/commands/create-system-page';
import { SavePageConfig } from './application/commands/save-page-config';
import { GetEditorSession } from './application/queries/get-editor-session';
import { ListDatasetUsage } from './application/queries/list-dataset-usage';
import { ListMapUsage } from './application/queries/list-map-usage';
import { ListMediaUsage } from './application/queries/list-media-usage';
import { ListPages } from './application/queries/list-pages';
import { ListPagesForRelease } from './application/queries/list-pages-for-release';
import { RenderDraftPage } from './application/queries/render-draft-page';
import { ResolvePageTitles } from './application/queries/resolve-page-titles';
import { createComponentCatalog } from './domain/models/component-catalog';
import { restorePageConfig } from './domain/models/page-config';
import { datasetUsesOf, savedMapIdsOf } from './domain/models/page-dataset-usage';
import { AuthBuilderAccess } from './infrastructure/access/auth-builder-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerBuilderAuditLog,
} from './infrastructure/audit/logger-builder-audit-log';
import { ComponentPlatformDescriptorProvider } from './infrastructure/component-platform/component-platform-descriptor-provider';
import { ComponentPlatformDraftRenderer } from './infrastructure/component-platform/component-platform-draft-renderer';
import { PrismaPageRepository } from './infrastructure/prisma/prisma-page.repository';

import type { BuilderDependencies } from './application/builder-dependencies';
import type { CreateSystemPageError } from './application/commands/create-system-page';
import type { SavePageConfigError } from './application/commands/save-page-config';
import type {
  CreateSystemPageInput,
  SavePageConfigInput,
} from './application/contracts/page-inputs';
import type {
  PageConfigView,
  PageSummaryView,
  SavedRevisionView,
} from './application/contracts/page-views';
import type { ReleasePageView } from './application/contracts/release-page-views';
import type { ListPagesForReleaseError } from './application/queries/list-pages-for-release';
import type { DatasetUse } from './domain/models/page-dataset-usage';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error.
 *
 * Like auth and audit, dependencies and use cases are process singletons
 * built only when first requested. The component catalog is built once from
 * the platform's descriptors, so use cases never touch the registry.
 */
const getPages = once(() => new PrismaPageRepository(systemClock));

/*
 * Both platform queries are infallible (`AppResult<_, never>`), so the error
 * branch has type `never` and needs no handling.
 */
const getComponents = once(() => {
  const platformCatalog = getComponentPlatformQueries()
    .listComponentCatalog.execute()
    .match(
      (view) => view.components,
      (error) => error,
    );
  return createComponentCatalog(
    new ComponentPlatformDescriptorProvider(platformCatalog, (parentType, childType) =>
      getComponentPlatformQueries()
        .canNestComponent.execute({ parentType, childType })
        .match(
          (allowed) => allowed,
          (error) => error,
        ),
    ).listDescriptors(),
  );
});

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerBuilderAuditLog, {
  source: 'builder',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

const getDependencies = once<BuilderDependencies>(() => ({
  access: new AuthBuilderAccess(getAuthQueries, getAccessControl()),
  pages: getPages(),
  components: getComponents(),
  audit: auditLog,
}));

/** Commands authorize the page's own website and record their outcome in the audit trail. */
export const getBuilderCommands = once(() => {
  const dependencies = getDependencies();
  return {
    createPage: new CreatePage(dependencies),
    savePageConfig: new SavePageConfig({ ...dependencies, rateLimiter: getRateLimiter() }),
  } as const;
});

export const getBuilderQueries = once(() => {
  const dependencies = getDependencies();
  return {
    getEditorSession: new GetEditorSession(dependencies),
    listPages: new ListPages(dependencies),
    listDatasetUsage: new ListDatasetUsage(dependencies),
    listMapUsage: new ListMapUsage(dependencies),
    listMediaUsage: new ListMediaUsage(dependencies),
    resolvePageTitles: new ResolvePageTitles(dependencies),
    renderDraftPage: new RenderDraftPage<ReactNode>({
      access: dependencies.access,
      rateLimiter: getRateLimiter(),
      pages: dependencies.pages,
      renderer: new ComponentPlatformDraftRenderer(renderPageNodes),
    }),
  } as const;
});

/**
 * The editor session of one page, read once per request: the page's metadata and the editor
 * under it share one answer instead of each loading the page.
 */
export const loadEditorSession = cache((websiteId: string, pageId: string) =>
  getBuilderQueries().getEditorSession.execute(websiteId, pageId),
);

const getCreateSystemPage = once(
  () => new CreateSystemPage({ pages: getPages(), components: getComponents(), audit: auditLog }),
);
const getListPagesForRelease = once(() => new ListPagesForRelease({ pages: getPages() }));

/*
 * Module-to-module entry points (re-exported by `index.ts`). The two page
 * readers and the system page seed have no actor: the caller authorizes on
 * its own side and passes values read from STORED records, never from a
 * request. `savePageDraft` is the exception and is stated as such below.
 */

/** Seeds a page for a website a trusted module just created. */
export function createSystemPage(
  input: CreateSystemPageInput,
): AppResultAsync<PageSummaryView, CreateSystemPageError> {
  return getCreateSystemPage().execute(input);
}

/** Every page of a website with its latest saved configuration, for publishing. */
export function listPagesForRelease(
  websiteId: string,
): AppResultAsync<readonly ReleasePageView[], ListPagesForReleaseError> {
  return getListPagesForRelease().execute(websiteId);
}

/**
 * Reads page configuration JSON that the builder once validated and someone
 * else stored (a release snapshot, say) back into a typed tree, with the
 * builder's own invariants. The one place any other module learns what a
 * valid tree is, so no module keeps its own tree reader or its own limits.
 */
export function restoreStoredPageConfig(
  stored: unknown,
): AppResult<PageConfigView, UnexpectedAppError> {
  return restorePageConfig(stored);
}

/** Which stored page holds the booking, for links that name the website and not a page. */
export { findBookingPagePath } from './application/services/find-booking-page';

/**
 * The components of stored page JSON (a release snapshot's page, say) that
 * read datasets, found through the builder's own catalog. A tree that cannot
 * be read reads nothing. Lets another module answer "is this dataset live?"
 * without its own tree walker.
 */
export function datasetUsesInStoredPage(stored: unknown): readonly DatasetUse[] {
  return restorePageConfig(stored).match(
    (config) => datasetUsesOf(config, getComponents()),
    () => [],
  );
}

/**
 * The saved maps stored page JSON places, found through the builder's own catalog. A tree that
 * cannot be read places none. Lets another module answer "is this map on a page?" without its
 * own tree walker.
 */
export function savedMapIdsInStoredPage(stored: unknown): ReadonlySet<string> {
  return restorePageConfig(stored).match(
    (config) => savedMapIdsOf(config, getComponents()),
    () => new Set<string>(),
  );
}

/**
 * The builder's ordinary save of a new revision for the CURRENT actor:
 * authenticated, authorized for the page and validated exactly like an
 * editor's save, so a trusted module never writes around the builder.
 */
export function savePageDraft(
  input: SavePageConfigInput,
): AppResultAsync<SavedRevisionView, SavePageConfigError> {
  return getBuilderCommands().savePageConfig.execute(input);
}
