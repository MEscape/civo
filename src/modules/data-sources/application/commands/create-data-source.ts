import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createDataSourceDraft } from '../../domain/models/data-source';
import { toDataSourceView } from '../data-source-view-mappers';

import type { CreateDataSourceInput } from '../contracts/data-source-inputs';
import type { DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

type CreateDataSourceError =
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
    const { access, dataSources, audit } = this.deps;

    return access.authorizeWebsite('datasource.create', input.websiteId).andThen((scope) =>
      createDataSourceDraft(input)
        .asyncAndThen((draft) => dataSources.create({ tenantId: scope.tenantId, draft }))
        .map((source) => {
          audit.record({
            type: 'data_source.created',
            actorId: scope.actorId,
            tenantId: scope.tenantId,
            websiteId: source.websiteId,
            dataSourceId: source.id,
            kind: source.kind,
          });
          return toDataSourceView(source);
        }),
    );
  }
}
