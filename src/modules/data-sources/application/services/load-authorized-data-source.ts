import type { AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { dataSourceNotFound } from '../../domain/errors/data-source-errors';
import { parseDataSourceId } from '../../domain/models/ids';

import type { DataSource } from '../../domain/models/data-source';
import type { DataSourceScope } from '../../domain/ports/data-source-access.port';
import type { DataSourceDependencies } from '../data-source-dependencies';

export type LoadDataSourceError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

interface AuthorizedDataSource {
  readonly scope: DataSourceScope;
  readonly source: DataSource;
}

/** Authenticate before routing by stored ownership; authorize the target before loading its contents. */
export function loadAuthorizedDataSource(
  deps: DataSourceDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedDataSource, LoadDataSourceError> {
  const notFound = dataSourceNotFound;
  return deps.authorization.requireActor().andThen(() =>
    parseDataSourceId(rawId).asyncAndThen((id) =>
      deps.dataSources.findWebsiteId(id).andThen((websiteId) => {
        if (websiteId === null) {
          return errAsync(notFound());
        }
        return deps.access
          .authorizeWebsite(permission, websiteId)
          .mapErr((error) => (error.kind === 'forbidden' ? notFound() : error))
          .andThen((scope) =>
            deps.dataSources
              .findById(id, scope.tenantId)
              .andThen((found): AppResultAsync<DataSource, NotFoundAppError> =>
                found === null ? errAsync(notFound()) : okAsync(found),
              )
              .andThen((found) =>
                found.websiteId === scope.websiteId && found.tenantId === scope.tenantId
                  ? okAsync({ scope, source: found })
                  : errAsync(notFound()),
              ),
          );
      }),
    ),
  );
}
