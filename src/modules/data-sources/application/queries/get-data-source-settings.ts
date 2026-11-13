import type { AppResultAsync } from '@lib/result';

import { toDataSourceSettingsView } from '../data-source-view-mappers';
import { loadAuthorizedDataSource } from '../services/load-authorized-data-source';

import type { DataSourceSettingsView } from '../contracts/data-source-views';
import type { DataSourceDependencies } from '../data-source-dependencies';
import type { LoadDataSourceError } from '../services/load-authorized-data-source';

/** A source's editable settings for its edit form, under the permission that saves them. */
export class GetDataSourceSettings {
  constructor(private readonly deps: DataSourceDependencies) {}

  execute(id: string): AppResultAsync<DataSourceSettingsView, LoadDataSourceError> {
    return loadAuthorizedDataSource(this.deps, id, 'datasource.update').map(({ source }) =>
      toDataSourceSettingsView(source),
    );
  }
}
