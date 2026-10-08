import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseWebsiteId } from '../../domain/models/ids';
import { toDataSourceView } from '../data-source-view-mappers';
import { MAX_SOURCES_PER_WEBSITE } from '../list-limits';

import type { DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

/** The sources of one website. A website of another tenant simply has none visible. Always bounded. */
export class ListDataSources {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    websiteId: string,
  ): AppResultAsync<
    readonly DataSourceView[],
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, dataSources } = this.deps;

    return authorization
      .requireInTenant('datasource.read')
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          dataSources.listByWebsite(id, actor.tenantId, MAX_SOURCES_PER_WEBSITE),
        ),
      )
      .map((sources) => sources.map(toDataSourceView));
  }
}
