/**
 * Server-side public API of the data-sources module. Other modules and
 * framework entry points import from here and nowhere deeper. Components
 * that run in the browser import from `./client` instead: this file reaches
 * server-only code and must never end up in a client bundle.
 */

export { dataSourceQueries } from './composition';

export { DataSourcesSettings } from './presentation/components/data-sources-settings';

export type { CanonicalKind, MappedRecordsView } from './application/contracts/data-source-views';

export { default as enDataSource } from './presentation/i18n/en.json';
export { default as deDataSource } from './presentation/i18n/de.json';
