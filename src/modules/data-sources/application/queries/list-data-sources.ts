import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { toDataSourceView } from '../data-source-view-mappers';
import { MAX_SOURCES_PER_WEBSITE } from '../data-sources-limits';

import type { DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

/** The sources of one website. A website of another tenant simply has none visible. Always bounded. */
export class ListDataSources {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<
    { readonly items: readonly DataSourceView[]; readonly isTruncated: boolean },
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { access, dataSources } = this.deps;

    return access
      .authorizeWebsite('datasource.read', websiteId)
      .andThen((scope) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          dataSources.listByWebsite(id, scope.tenantId, MAX_SOURCES_PER_WEBSITE),
        ),
      )
      .map((sources) => ({
        items: sources.items.map(toDataSourceView),
        isTruncated: sources.isTruncated,
      }));
  }
}
