import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';
import { okAsync } from '@lib/result';

import { parseWebsiteId, parseDataSourceId } from '../../domain/models/ids';
import { toDataSourceWithDatasetsView } from '../data-source-view-mappers';
import { DATA_SOURCE_PAGE_LIMITS, MAX_DATASETS_PER_SOURCE } from '../data-sources-limits';

import type { ListDataSourcesWithDatasetsOptions } from '../contracts/data-source-inputs';
import type { DataSourceWithDatasetsView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

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
    const { access, dataSources } = this.deps;
    const requested = resolvePageRequest(options, DATA_SOURCE_PAGE_LIMITS);

    return access
      .authorizeWebsite('datasource.read', websiteId)
      .andThen(() => access.authorizeWebsite('dataset.read', websiteId))
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) => {
          const page: AppResultAsync<PageRequest, ValidationAppError | InfrastructureAppError> =
            options.sourceId === undefined
              ? okAsync(requested)
              : parseDataSourceId(typeof options.sourceId === 'string' ? options.sourceId : '')
                  .asyncAndThen((sourceId) =>
                    dataSources.pageOfSource({
                      websiteId: id,
                      tenantId: scope.tenantId,
                      sourceId,
                      pageSize: requested.pageSize,
                    }),
                  )
                  .map((position) => ({ ...requested, page: position ?? requested.page }));
          return page.andThen((resolved) =>
            loadClampedPage(resolved, (request) =>
              dataSources.listWithDatasets(id, scope.tenantId, {
                page: request,
                datasetsPerSource: MAX_DATASETS_PER_SOURCE,
              }),
            ),
          );
        }),
      )
      .map((found) => ({ ...found, items: found.items.map(toDataSourceWithDatasetsView) }));
  }
}
