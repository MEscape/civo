import { err } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { toSampleRecords } from '../../domain/discovery/discovery';
import { noSampleRecords } from '../../domain/errors/data-source-errors';
import { applyMapping } from '../../domain/mapping/apply-mapping';

import type { DatasetMapping } from '../../domain/mapping/dataset-mapping';
import type { DataSource } from '../../domain/models/data-source';
import type {
  ConnectorError,
  DataSourceConnector,
} from '../../domain/ports/data-source-connector.port';

export type DryRunError = ConnectorError;

/**
 * Applies a candidate mapping to ONE live sample record, without saving.
 * Shared by the preview and by save, so the dry run a user sees is exactly
 * the check that gates persistence. It always goes to the external system.
 */
export function dryRunMapping(
  connector: DataSourceConnector,
  source: DataSource,
  mapping: DatasetMapping,
): AppResultAsync<Record<string, unknown>, DryRunError> {
  return connector
    .fetchBody(source)
    .andThen((body): AppResult<Record<string, unknown>, DryRunError> => {
      const [sample] = toSampleRecords(body);
      return sample === undefined ? err(noSampleRecords()) : applyMapping(mapping, sample);
    });
}
