import { err } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { DISCOVERY_LIMITS, toSampleRecords } from '../../domain/discovery/discovery';
import { noSampleRecords } from '../../domain/errors/data-source-errors';
import { applyMapping } from '../../domain/mapping/apply-mapping';
import { firstRecords } from '../../domain/pagination/read-window';

import type { DatasetMapping } from '../../domain/mapping/dataset-mapping';
import type { DataSource } from '../../domain/models/data-source';
import type {
  ConnectorError,
  DataSourceConnector,
} from '../../domain/ports/data-source-connector.port';

export type DryRunError = ConnectorError;

/** Where the sample comes from: the source, and the dataset's path into its response. */
export interface DryRunTarget {
  readonly source: DataSource;
  readonly path: string | null;
}

/**
 * Applies a candidate mapping to ONE live sample record, without saving.
 * Shared by the preview and by save, so the dry run a user sees is exactly
 * the check that gates persistence. It always goes to the external system.
 */
export function dryRunMapping(
  connector: DataSourceConnector,
  { source, path }: DryRunTarget,
  mapping: DatasetMapping,
): AppResultAsync<Record<string, unknown>, DryRunError> {
  return connector
    .fetchBody(source, { window: firstRecords(DISCOVERY_LIMITS.sampleSize), path })
    .andThen((body): AppResult<Record<string, unknown>, DryRunError> => {
      const [sample] = toSampleRecords(body);
      return sample === undefined ? err(noSampleRecords()) : applyMapping(mapping, sample);
    });
}
