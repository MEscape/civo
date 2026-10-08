/**
 * Server-side public API of the release module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { releaseQueries } from './composition';

export { MigrationPanel } from './presentation/components/migration-panel';
export { ReleaseHistoryPanel } from './presentation/components/release-history-panel';

export { default as enRelease } from './presentation/i18n/en.json';
export { default as deRelease } from './presentation/i18n/de.json';
