import type { AppResultAsync } from '@lib/result';

import { toDataSourceView } from '../data-source-view-mappers';
import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';

import type { DataSourceView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';

export class GetDataSource {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(id: string): AppResultAsync<DataSourceView, LoadDataSourceError> {
    return loadAuthorizedDataSource(this.deps, id, 'datasource.read').map(({ source }) =>
      toDataSourceView(source),
    );
  }
}
