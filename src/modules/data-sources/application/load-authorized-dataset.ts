import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { datasetNotFound } from '../domain/errors/data-source-errors';
import { parseDatasetId } from '../domain/models/ids';

import { scopeOf } from './data-source-scope';

import type { DataSourceDependencies } from './data-source-dependencies';
import type { DataSource } from '../domain/models/data-source';
import type { Dataset, DatasetWithSource } from '../domain/models/dataset';

/** Everything an operation on one existing dataset can fail with. */
export type LoadDatasetError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface AuthorizedDataset {
  readonly actor: Actor;
  readonly dataset: Dataset;
  /** The complete parent source, for operations that call the external system. */
  readonly source: DataSource;
}

/**
 * Same three steps as `loadAuthorizedDataSource`, for a dataset: the tenant
 * is read through its parent source, and lookups are by (id, actor.tenantId).
 */
export function loadAuthorizedDataset(
  deps: DataSourceDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<AuthorizedDataset, LoadDatasetError> {
  const { authorization, datasets } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parseDatasetId(rawId)
      .asyncAndThen((id) => datasets.findWithSource(id, actor.tenantId))
      .andThen((found): AppResultAsync<DatasetWithSource, NotFoundAppError> =>
        found === null ? errAsync(datasetNotFound()) : okAsync(found),
      )
      .andThen(({ dataset, source }) =>
        authorization
          .requireOnResource(permission, scopeOf(dataset))
          .map((verifiedActor) => ({ actor: verifiedActor, dataset, source })),
      ),
  );
}
