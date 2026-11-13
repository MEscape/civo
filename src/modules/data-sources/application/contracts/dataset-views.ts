import type { DiscoveredField } from '../../domain/discovery/discovery';
import type { DatasetMapping } from '../../domain/mapping/dataset-mapping';
import type { MappedRecord } from '../../domain/mapping/mapped-record';
import type { CanonicalKind } from '../../domain/models/canonical-kinds';
import type { DataProvenance } from '../../domain/models/data-provenance';
import type { DataSourceKind, DataSourceStatus } from '../../domain/models/data-source-kinds';

export type { CanonicalKind };

/** The mapping as consumers see it. Plain, serializable, fully resolved. */
export type DatasetMappingView = DatasetMapping;

/** A field found in a live sample: path, type and a short preview. */
export type DiscoveredFieldView = DiscoveredField;

/** One external record after mapping. `values` is UNVALIDATED canonical data. */
type MappedRecordView = MappedRecord;

export interface DatasetChoicesView {
  readonly items: readonly DatasetView[];
  readonly isTruncated: boolean;
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
  /** The endpoint below the source's base URL; null uses the source's own. */
  readonly path: string | null;
  readonly mapping: DatasetMappingView | null;
  readonly status: DataSourceStatus;
  readonly lastFetchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type { DatasetSetup as DatasetSetupView } from '../../domain/ports/dataset.repository';

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
  /** A declared source budget; spatial consumers must not widen a read past it. */
  readonly maxWindowRecords?: number;
  readonly provenance?: DataProvenance;
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  readonly records: readonly MappedRecordView[];
  readonly skipped: number;
  readonly truncated: boolean;
  /**
   * The source's API was asked for the window's area, so the records are those of that area. When
   * an area was wanted and this is `false`, the records are the source's first ones and the caller
   * must apply the area itself, over as many records as it can read.
   */
  readonly isAreaApplied: boolean;
}
