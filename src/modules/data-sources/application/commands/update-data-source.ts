import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { deepEqual } from '@lib/utils';

import { parseDataSourceChanges } from '../../domain/models/data-source';
import { toDataSourceView } from '../data-source-view-mappers';
import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';

import type { UpdateDataSourceInput } from '../contracts/data-source-inputs';
import type { DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';

/**
 * Renames a source or changes its connection (address, authentication, records, pagination). The
 * kind never changes. A changed connection clears the last test: the stored result described the
 * old address. Credentials are not part of a source; they stay in the server's environment.
 */
export class UpdateDataSource {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(input: UpdateDataSourceInput): AppResultAsync<DataSourceView, LoadDataSourceError> {
    const { dataSources, audit } = this.deps;

    return loadAuthorizedDataSource(this.deps, input.dataSourceId, 'datasource.update').andThen(
      ({ scope, source }) =>
        parseDataSourceChanges(source, input).asyncAndThen((changes) => {
          const isConfigChanged = !deepEqual(changes.config, source.config);
          const changedFields = [
            ...(changes.name === source.name ? [] : (['name'] as const)),
            ...(isConfigChanged ? (['config'] as const) : []),
          ];
          if (changedFields.length === 0) {
            return okAsync(toDataSourceView(source));
          }
          return dataSources
            .update(source.id, scope.tenantId, { ...changes, resetsCheck: isConfigChanged })
            .map((updated) => {
              audit.record({
                type: 'data_source.updated',
                actorId: scope.actorId,
                tenantId: scope.tenantId,
                websiteId: updated.websiteId,
                dataSourceId: updated.id,
                changedFields,
              });
              return toDataSourceView(updated);
            });
        }),
    );
  }
}
