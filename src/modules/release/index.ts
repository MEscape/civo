/**
 * Server-side public API of the release module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export {
  getReleaseQueries,
  invalidateRemovedData,
  invalidateRemovedMap,
  loadPublicationStatus,
  releaseQueries,
} from './composition';

export { PublicationBanner } from './presentation/components/publication/publication-banner';
export { PublishStatus } from './presentation/components/publication/publish-status';
export { ReleaseActivityCard } from './presentation/components/publication/release-activity-card';
export { ReleaseAdministration } from './presentation/components/releases/release-administration';
export { ReleasePreview } from './presentation/components/preview/release-preview';
export type {
  PublishedPageView,
  PublishedSnapshotView,
} from './application/contracts/snapshot-views';
export { releaseRoutes } from './presentation/routes';

export { default as enRelease } from './presentation/i18n/en.json';
export { default as deRelease } from './presentation/i18n/de.json';

export type { PublicationStatusView } from './application/contracts/publication-views';
