/**
 * Server-side public API of the release module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { invalidateRemovedData, releaseQueries } from './composition';

export { HistoryPagination } from './presentation/components/history-pagination';
export { MigrationPanel } from './presentation/components/migration-panel';
export { PublicationBanner } from './presentation/components/publication-banner';
export { PublishStatus } from './presentation/components/publish-status';
export { ReleaseActivityCard } from './presentation/components/release-activity-card';
export { ReleaseHistoryPanel } from './presentation/components/release-history-panel';
export { ReleaseStatusBadge } from './presentation/components/release-status-badge';
export { RestoreReleaseButton } from './presentation/components/restore-release-button';
export type { PreviewFidelityView } from './application/contracts/release-views';

export { default as enRelease } from './presentation/i18n/en.json';
export { default as deRelease } from './presentation/i18n/de.json';
