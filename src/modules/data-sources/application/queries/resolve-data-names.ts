import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync, parseValidIds } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseDataSourceId, parseDatasetId, parseWebsiteId } from '../../domain/models/ids';
import { MAX_RESOLVED_NAMES } from '../list-limits';

import type { DataNamesView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

export interface ResolveDataNamesInput {
  readonly dataSourceIds: readonly string[];
  readonly datasetIds: readonly string[];
}

/**
 * The names of some sources and datasets of a website, so a screen that keeps
 * only their ids (the audit log) can name them. Whoever may read data sources
 * may ask; an id that names nothing of the website (deleted, another
 * website's) is absent from the answer, so the caller tells "gone" from
 * "named". One read per kind, only for the kinds asked for.
 */
export class ResolveDataNames {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(
    websiteId: string,
    input: ResolveDataNamesInput,
  ): AppResultAsync<
    DataNamesView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization, dataSources, datasets } = this.deps;
    const sourceIds = parseValidIds(input.dataSourceIds, parseDataSourceId, MAX_RESOLVED_NAMES);
    const datasetIds = parseValidIds(input.datasetIds, parseDatasetId, MAX_RESOLVED_NAMES);

    return authorization
      .requireInTenant('datasource.read')
      .andThen((actor) =>
        parseWebsiteId(websiteId).asyncAndThen((id) =>
          ResultAsync.combine([
            dataSources.findNames(id, actor.tenantId, sourceIds),
            datasets.findNames(id, actor.tenantId, datasetIds),
          ] as const).map(([sources, sets]) => ({ dataSources: sources, datasets: sets })),
        ),
      );
  }
}
