/**
 * Server-side public API of the builder module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { builderQueries } from './composition';

/** Module-to-module entry points for trusted callers: they have no actor, see `composition.ts`. */
export {
  createSystemPage,
  listPagesForRelease,
  restoreStoredPageConfig,
  savePageDraft,
} from './composition';

export { CreatePageForm } from './presentation/components/create-page-form';
export { PageList } from './presentation/components/page-list';
export { toPageSummaryDto } from './presentation/dto/page-dto';
export { BuilderSessionProvider } from './presentation/components/builder-session-provider';
export { BuilderShell } from './presentation/components/builder-shell';
export { toEditorSessionDto } from './presentation/dto/editor-session-dto';
export { collectDatasetTypes } from './presentation/properties/dataset-types';
export { toDatasetOptionsByType } from './presentation/dto/dataset-options-dto';
export { builderRoutes } from './presentation/routes';

export { HOME_PAGE_PATH } from './application/contracts/builder-constraints';

export { default as enBuilder } from './presentation/i18n/en.json';
export { default as deBuilder } from './presentation/i18n/de.json';

export type { CreateSystemPageError } from './application/commands/create-system-page';

export type {
  CreateSystemPageInput,
  PageConfigView,
  PageNodeInput,
  PageSummaryView,
  ReleasePageView,
  SavePageConfigInput,
  SavedRevisionView,
} from './application/contracts/page-views';
