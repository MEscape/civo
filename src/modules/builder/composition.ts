import 'server-only';

import type { ReactNode } from 'react';

import { getAccessControl } from '@modules/auth';
import { componentPlatformQueries, renderPageNodes } from '@modules/component-platform';

import { systemClock } from '@lib/clock';
import type { UnexpectedAppError } from '@lib/errors';
import type { AppResult, AppResultAsync } from '@lib/result';

import { CreatePage } from './application/commands/create-page';
import { CreateSystemPage } from './application/commands/create-system-page';
import { SavePageConfig } from './application/commands/save-page-config';
import { GetEditorSession } from './application/queries/get-editor-session';
import { ListPages } from './application/queries/list-pages';
import { ListPagesForRelease } from './application/queries/list-pages-for-release';
import { RenderDraftPage } from './application/queries/render-draft-page';
import { createComponentCatalog } from './domain/models/component-catalog';
import { restorePageConfig } from './domain/models/page-config';
import { ComponentPlatformDescriptorProvider } from './infrastructure/component-platform/component-platform-descriptor-provider';
import { ComponentPlatformDraftRenderer } from './infrastructure/component-platform/component-platform-draft-renderer';
import { loggerBuilderAuditLog } from './infrastructure/logging/logger-builder-audit-log';
import { PrismaPageRepository } from './infrastructure/prisma/prisma-page.repository';

import type { CreateSystemPageError } from './application/commands/create-system-page';
import type { SavePageConfigError } from './application/commands/save-page-config';
import type {
  CreateSystemPageInput,
  PageConfigView,
  PageSummaryView,
  ReleasePageView,
  SavePageConfigInput,
  SavedRevisionView,
} from './application/contracts/page-views';
import type { PageDependencies } from './application/page-dependencies';
import type { ListPagesForReleaseError } from './application/queries/list-pages-for-release';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error.
 *
 * Use cases are built once per process; per-request state lives behind
 * `getAccessControl`. The component catalog is built once from the
 * platform's descriptors, so use cases never touch the registry.
 */
const authorization = getAccessControl();
const pages = new PrismaPageRepository(systemClock);
/*
 * Both platform queries are infallible (`AppResult<_, never>`), so the error
 * branch has type `never` and needs no handling.
 */
const platformCatalog = componentPlatformQueries.listComponentCatalog.execute().match(
  (view) => view.components,
  (error) => error,
);
const components = createComponentCatalog(
  new ComponentPlatformDescriptorProvider(platformCatalog, (parentType, childType) =>
    componentPlatformQueries.canNestComponent.execute({ parentType, childType }).match(
      (allowed) => allowed,
      (error) => error,
    ),
  ).listDescriptors(),
);

const dependencies: PageDependencies = {
  authorization,
  pages,
  components,
  audit: loggerBuilderAuditLog,
};

export const builderCommands = {
  createPage: new CreatePage(dependencies),
  savePageConfig: new SavePageConfig(dependencies),
} as const;

export const builderQueries = {
  getEditorSession: new GetEditorSession(dependencies),
  listPages: new ListPages(dependencies),
  renderDraftPage: new RenderDraftPage<ReactNode>({
    authorization,
    pages,
    renderer: new ComponentPlatformDraftRenderer(renderPageNodes),
  }),
} as const;

const createSystemPageCommand = new CreateSystemPage({
  pages,
  components,
  audit: loggerBuilderAuditLog,
});
const listPagesForReleaseQuery = new ListPagesForRelease({ pages });

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
  return createSystemPageCommand.execute(input);
}

/** Every page of a website with its latest saved configuration, for publishing. */
export function listPagesForRelease(
  websiteId: string,
): AppResultAsync<readonly ReleasePageView[], ListPagesForReleaseError> {
  return listPagesForReleaseQuery.execute(websiteId);
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

/**
 * The builder's ordinary save of a new revision for the CURRENT actor:
 * authenticated, authorized for the page and validated exactly like an
 * editor's save, so a trusted module never writes around the builder.
 */
export function savePageDraft(
  input: SavePageConfigInput,
): AppResultAsync<SavedRevisionView, SavePageConfigError> {
  return builderCommands.savePageConfig.execute(input);
}
