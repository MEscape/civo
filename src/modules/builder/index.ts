/**
 * Server-side public API of the builder module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

/** Server-only helpers for Server Components. Mutations are reachable through Server Actions only. */
export { getBuilderQueries, loadEditorSession } from './composition';

/** Module-to-module entry points for trusted callers: they have no actor, see `composition.ts`. */
export {
  createSystemPage,
  listPagesForRelease,
  datasetUsesInStoredPage,
  savedMapIdsInStoredPage,
  findBookingPagePath,
  restoreStoredPageConfig,
  savePageDraft,
} from './composition';

export { BuilderPagesAdministration } from './presentation/components/pages/builder-pages-administration';
export { CreatePageWizard } from './presentation/components/pages/create-page-wizard';
export { BuilderEditor } from './presentation/components/builder-editor';
export { builderRoutes } from './presentation/routes';

export { HOME_PAGE_PATH } from './application/contracts/builder-constraints';

export { default as enBuilder } from './presentation/i18n/en.json';
export { default as deBuilder } from './presentation/i18n/de.json';

export type { CreateSystemPageError } from './application/commands/create-system-page';

export type {
  CreateSystemPageInput,
  PageNodeInput,
  SavePageConfigInput,
} from './application/contracts/page-inputs';
export type {
  PageConfigView,
  PageSummaryView,
  SavedRevisionView,
} from './application/contracts/page-views';
export type { ReleasePageView } from './application/contracts/release-page-views';
export type { MapPageUseView, MapUsageView } from './application/contracts/map-usage-views';
export { PagesOverviewTile } from './presentation/components/pages/pages-overview-tile';
