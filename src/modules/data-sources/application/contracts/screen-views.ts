import type { Page } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { ListDataSourcesWithDatasetsOptions } from './data-source-inputs';
import type {
  DataSourceSettingsView,
  DataSourceView,
  DataSourceWithDatasetsView,
} from './data-source-views';
import type { DatasetSetupView, DatasetView } from './dataset-views';

/** Screen readers retain their own authorization and can be supplied independently in loader tests. */
export interface DataSourceReaders {
  readonly getDataSource: { execute(id: string): AppResultAsync<DataSourceView> };
  readonly getDataSourceSettings: {
    execute(id: string): AppResultAsync<DataSourceSettingsView>;
  };
  readonly getDataset: { execute(id: string): AppResultAsync<DatasetView> };
  readonly getDataSourceSetup: { execute(websiteId: string): AppResultAsync<DatasetSetupView> };
  readonly listDataSourcesWithDatasets: {
    execute(
      websiteId: string,
      options?: ListDataSourcesWithDatasetsOptions,
    ): AppResultAsync<Page<DataSourceWithDatasetsView>>;
  };
}
