import type { DiscoveredField } from '../../domain/discovery/discovery';
import type { DatasetMapping, DatasetMappingInput } from '../../domain/mapping/dataset-mapping';
import type { MappedRecord } from '../../domain/mapping/mapped-record';
import type { CanonicalKind } from '../../domain/models/canonical-kinds';
import type { DataSourceDraftInput } from '../../domain/models/data-source';
import type { DataSourceKind, DataSourceStatus } from '../../domain/models/data-source-kinds';
import type { DatasetChangesInput, DatasetDraftInput } from '../../domain/models/dataset';

export type { CanonicalKind, DataSourceKind, DataSourceStatus, DatasetMappingInput };

/** The mapping as consumers see it. Plain, serializable, fully resolved. */
export type DatasetMappingView = DatasetMapping;

/** A field found in a live sample: path, type and a short preview. */
export type DiscoveredFieldView = DiscoveredField;

/** One external record after mapping. `values` is UNVALIDATED canonical data. */
export type MappedRecordView = MappedRecord;

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

export interface DatasetView {
  readonly id: string;
  readonly websiteId: string;
  readonly source: {
    readonly id: string;
    readonly name: string;
    readonly kind: DataSourceKind;
    readonly status: DataSourceStatus;
  };
  readonly name: string;
  readonly slug: string;
  readonly canonicalKind: CanonicalKind;
  readonly mapping: DatasetMappingView | null;
  readonly status: DataSourceStatus;
  readonly lastFetchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DataSourceWithDatasetsView extends DataSourceView {
  readonly datasets: readonly DatasetView[];
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

export interface DatasetRemovalView {
  readonly id: string;
  readonly websiteId: string;
}

/** Field names and short previews only. The raw sample records never leave the server. */
export interface DiscoveryView {
  readonly fields: readonly DiscoveredFieldView[];
}

export interface MappingPreviewView {
  readonly values: Readonly<Record<string, unknown>>;
}

/** What a content consumer receives: mapped, UNVALIDATED records of one dataset. */
export interface MappedRecordsView {
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  readonly records: readonly MappedRecordView[];
  readonly skipped: number;
  readonly truncated: boolean;
}

export type CreateDataSourceInput = DataSourceDraftInput;

export interface CreateDatasetInput extends DatasetDraftInput {
  readonly dataSourceId: string;
}

export interface UpdateDatasetInput extends DatasetChangesInput {
  readonly datasetId: string;
}

export interface SaveDatasetMappingInput {
  readonly datasetId: string;
  readonly mapping: DatasetMappingInput;
}

export type PreviewDatasetMappingInput = SaveDatasetMappingInput;
