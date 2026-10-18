import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { toDataSourceWithDatasetsView } from '../data-source-view-mappers';
import { DATA_SOURCE_PAGE_LIMITS, MAX_DATASETS_PER_SOURCE } from '../list-limits';

import type { DataSourceWithDatasetsView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

/** The page asked for, as the address carries it: untrusted text, resolved here. */
export interface ListDataSourcesWithDatasetsOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}

/**
 * The data sources screen: one page of sources with their datasets, which
 * needs both read permissions. A page past the end answers the last one.
 */
export class ListDataSourcesWithDatasets {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    websiteId: string,
    options: ListDataSourcesWithDatasetsOptions = {},
  ): AppResultAsync<
    Page<DataSourceWithDatasetsView>,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, dataSources } = this.deps;
    const requested = resolvePageRequest(options, DATA_SOURCE_PAGE_LIMITS);

    return authorization
      .requireInTenant('datasource.read')
      .andThen(() => authorization.requireInTenant('dataset.read'))
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          loadClampedPage(requested, (request) =>
            dataSources.listWithDatasets(id, actor.tenantId, {
              page: request,
              datasetsPerSource: MAX_DATASETS_PER_SOURCE,
            }),
          ),
        ),
      )
      .map((found) => ({ ...found, items: found.items.map(toDataSourceWithDatasetsView) }));
  }
}
