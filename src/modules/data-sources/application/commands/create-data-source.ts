import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createDataSourceDraft } from '../../domain/models/data-source';
import { toDataSourceView } from '../data-source-view-mappers';

import type { CreateDataSourceInput, DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

export type CreateDataSourceError =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Registers a connection to an external system for a website. The config is
 * validated per kind, including the SSRF policy, before anything is stored.
 * The website must belong to the actor's tenant: the repository answers
 * "website not found" for a website of any other tenant.
 */
export class CreateDataSource {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(input: CreateDataSourceInput): AppResultAsync<DataSourceView, CreateDataSourceError> {
    const { authorization, dataSources, audit } = this.deps;

    return authorization.requireInTenant('datasource.create').andThen((actor) =>
      createDataSourceDraft(input)
        .asyncAndThen((draft) => dataSources.create({ tenantId: actor.tenantId, draft }))
        .map((source) => {
          audit.record({
            type: 'data_source.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: source.websiteId,
            dataSourceId: source.id,
            kind: source.kind,
          });
          return toDataSourceView(source);
        }),
    );
  }
}
