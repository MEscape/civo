import type { AppResultAsync } from '@lib/result';

import type { DataSourceAccessError } from '../../domain/ports/data-source-access.port';
import type { DatasetSetupView } from '../contracts/dataset-views';
import type { DataSourceDependencies } from '../data-source-dependencies';

/** Setup completion is a website fact, never a conclusion drawn from one visible page. */
export class GetDataSourceSetup {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(websiteId: string): AppResultAsync<DatasetSetupView, DataSourceAccessError> {
    return this.deps.access
      .authorizeWebsite('dataset.read', websiteId)
      .andThen((scope) => this.deps.datasets.getSetup(scope.websiteId, scope.tenantId));
  }
}
