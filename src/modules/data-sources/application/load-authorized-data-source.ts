import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { dataSourceNotFound } from '../domain/errors/data-source-errors';
import { parseDataSourceId } from '../domain/models/ids';

import { scopeOf } from './data-source-scope';

import type { DataSourceDependencies } from './data-source-dependencies';
import type { DataSource } from '../domain/models/data-source';

/** Everything an operation on one existing data source can fail with. */
export type LoadDataSourceError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedDataSource {
  readonly actor: Actor;
  readonly source: DataSource;
}

/**
 * The shared first half of every operation on an existing data source:
 *
 *  1. `requireInTenant` FIRST, so a caller without the permission learns
 *     nothing about which ids exist.
 *  2. Look the source up by (id, actor.tenantId): another tenant's id is
 *     simply "not found".
 *  3. `requireOnResource` against the STORED tenant, the backstop should a
 *     repository ever return a foreign record.
 */
export function loadAuthorizedDataSource(
  deps: DataSourceDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedDataSource, LoadDataSourceError> {
  const { authorization, dataSources } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseDataSourceId(rawId)
      .asyncAndThen((id) => dataSources.findById(id, actor.tenantId))
      .andThen((source): AppResultAsync<DataSource, NotFoundAppError> =>
        source === null ? errAsync(dataSourceNotFound()) : okAsync(source),
      )
      .andThen((source) =>
        authorization
          .requireOnResource(permission, scopeOf(source))
          .map((verifiedActor) => ({ actor: verifiedActor, source })),
      ),
  );
}
