import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync, parseValidIds } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { parseDataSourceId, parseDatasetId, parseWebsiteId } from '../../domain/models/ids';
import { MAX_RESOLVED_NAMES } from '../data-sources-limits';

import type { DataNamesView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

interface ResolveDataNamesInput {
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
    const { access, dataSources, datasets } = this.deps;
    const sourceIds = parseValidIds(input.dataSourceIds, parseDataSourceId, MAX_RESOLVED_NAMES + 1);
    const datasetIds = parseValidIds(input.datasetIds, parseDatasetId, MAX_RESOLVED_NAMES + 1);

    return access.authorizeWebsite('datasource.read', websiteId).andThen((scope) =>
      parseWebsiteId(websiteId).asyncAndThen((id) =>
        ResultAsync.combine([
          dataSources.findNames(id, scope.tenantId, sourceIds.slice(0, MAX_RESOLVED_NAMES)),
          datasets.findNames(id, scope.tenantId, datasetIds.slice(0, MAX_RESOLVED_NAMES)),
        ] as const).map(([sources, sets]) => ({
          dataSources: sources,
          datasets: sets,
          isTruncated:
            sourceIds.length > MAX_RESOLVED_NAMES || datasetIds.length > MAX_RESOLVED_NAMES,
        })),
      ),
    );
  }
}
