import type { AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { datasetNotFound } from '../../domain/errors/data-source-errors';
import { parseDatasetId } from '../../domain/models/ids';

import type { DatasetWithSource } from '../../domain/models/dataset';
import type { DataSourceScope } from '../../domain/ports/data-source-access.port';
import type { DataSourceDependencies } from '../data-source-dependencies';

export type LoadDatasetError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

interface AuthorizedDataset {
  readonly scope: DataSourceScope;
  readonly dataset: DatasetWithSource['dataset'];
  readonly source: DatasetWithSource['source'];
}

/** Authenticate before routing by stored ownership; authorize the target before loading its contents. */
export function loadAuthorizedDataset(
  deps: DataSourceDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedDataset, LoadDatasetError> {
  const notFound = datasetNotFound;
  return deps.authorization.requireActor().andThen(() =>
    parseDatasetId(rawId).asyncAndThen((id) =>
      deps.datasets.findWebsiteId(id).andThen((websiteId) => {
        if (websiteId === null) {
          return errAsync(notFound());
        }
        return deps.access
          .authorizeWebsite(permission, websiteId)
          .mapErr((error) => (error.kind === 'forbidden' ? notFound() : error))
          .andThen((scope) =>
            deps.datasets
              .findWithSource(id, scope.tenantId)
              .andThen((found): AppResultAsync<DatasetWithSource, NotFoundAppError> =>
                found === null ? errAsync(notFound()) : okAsync(found),
              )
              .andThen((found) =>
                found.dataset.websiteId === scope.websiteId &&
                found.dataset.tenantId === scope.tenantId &&
                found.source.websiteId === scope.websiteId &&
                found.source.tenantId === scope.tenantId &&
                found.source.id === found.dataset.source.id
                  ? okAsync({ scope, ...found })
                  : errAsync(notFound()),
              ),
          );
      }),
    ),
  );
}
