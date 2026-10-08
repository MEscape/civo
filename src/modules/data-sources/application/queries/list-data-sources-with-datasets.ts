import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { toDataSourceWithDatasetsView } from '../data-source-view-mappers';
import { MAX_DATASETS_PER_SOURCE, MAX_SOURCES_PER_WEBSITE } from '../list-limits';

import type { DataSourceWithDatasetsView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

/** The settings view: sources with their datasets, which needs both read permissions. Always bounded. */
export class ListDataSourcesWithDatasets {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<
    readonly DataSourceWithDatasetsView[],
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, dataSources } = this.deps;

    return authorization
      .requireInTenant('datasource.read')
      .andThen(() => authorization.requireInTenant('dataset.read'))
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          dataSources.listWithDatasets(id, actor.tenantId, {
            sources: MAX_SOURCES_PER_WEBSITE,
            datasetsPerSource: MAX_DATASETS_PER_SOURCE,
          }),
        ),
      )
      .map((rows) => rows.map(toDataSourceWithDatasetsView));
  }
}
