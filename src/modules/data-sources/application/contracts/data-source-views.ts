import type { DatasetView } from './dataset-views';
import type { SpatialFilter } from '../../domain/config/spatial-filter';
import type {
  AuthMode,
  DataSourceKind,
  DataSourceStatus,
} from '../../domain/models/data-source-kinds';
import type { PaginationStrategy } from '../../domain/pagination/pagination-strategy';

export type { DataSourceKind, DataSourceStatus };

/** A source's or dataset's name by id, for a screen that keeps only ids (the audit log). */
interface DataNameView {
  readonly id: string;
  readonly name: string;
}

/** The names asked for, per kind; an id that names nothing of the website is absent. */
export interface DataNamesView {
  readonly dataSources: readonly DataNameView[];
  readonly datasets: readonly DataNameView[];
  readonly isTruncated: boolean;
}

/**
 * A source for its owner. The raw `config` and the tenant are deliberately
 * absent: only a display-safe `endpoint` (origin and path, no query string)
 * is exposed, because a query string can carry a token.
 */
export interface DataSourceView {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly kind: DataSourceKind;
  readonly status: DataSourceStatus;
  readonly endpoint: string | null;
  readonly lastCheckedAt: Date | null;
  /** A stable code from the last failed check, translated by the UI. */
  readonly lastErrorCode: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The editable connection of a REST source, safe to prefill a form with. */
export interface RestConnectionSettingsView {
  /** The base URL without its query or fragment, which can carry a token. */
  readonly baseUrl: string;
  /** The stored address has a query or fragment that `baseUrl` leaves out; kept while the address is unchanged. */
  readonly hasHiddenUrlParts: boolean;
  readonly authMode: AuthMode;
  readonly recordsPath: string | null;
  readonly pagination: PaginationStrategy;
  /** How the API is asked for one area (a map window); `null` when it is not. */
  readonly spatialFilter: SpatialFilter | null;
}

/** A source as its edit form starts from. Credentials are never part of it: they live in the server environment. */
export interface DataSourceSettingsView {
  readonly id: string;
  readonly websiteId: string;
  readonly name: string;
  readonly kind: DataSourceKind;
  /** `null` for a source that is not REST, or whose stored config no longer parses. */
  readonly connection: RestConnectionSettingsView | null;
}

export interface DataSourceWithDatasetsView extends DataSourceView {
  readonly datasets: readonly DatasetView[];
  readonly isDatasetListTruncated: boolean;
}

/**
 * A failed test is a RECORDED OUTCOME of the diagnostic, not a failure of
 * the operation: it is stored on the source and shown to the user, so it
 * is modelled as a value. The operation itself fails only for access,
 * lookup or storage problems.
 */
export type ConnectionTestOutcome =
  { readonly isHealthy: true } | { readonly isHealthy: false; readonly errorCode: string };

export interface ConnectionTestView {
  readonly dataSourceId: string;
  readonly websiteId: string;
  readonly outcome: ConnectionTestOutcome;
}

export interface DataSourceRemovalView {
  readonly id: string;
  readonly websiteId: string;
  /** Datasets removed with the source, so their caches can be invalidated. */
  readonly removedDatasetIds: readonly string[];
}
