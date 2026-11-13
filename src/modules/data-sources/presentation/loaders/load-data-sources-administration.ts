import { orNotFound } from '@lib/errors/or-not-found';
import { buildQueryString } from '@lib/utils';

import { toDataSourceDto } from '../dto/data-source-dto';
import { dataSourceRoutes } from '../routes';

import type { DataSourceReaders } from '../../application/contracts/screen-views';

interface LoadDataSourcesInput {
  readonly websiteId: string;
  readonly page?: unknown;
  readonly pageSize?: unknown;
  readonly queries: Pick<DataSourceReaders, 'listDataSourcesWithDatasets' | 'getDataSourceSetup'>;
}

export async function loadDataSourcesAdministration({
  websiteId,
  page,
  pageSize,
  queries,
}: LoadDataSourcesInput) {
  const [sources, setup] = await Promise.all([
    orNotFound(queries.listDataSourcesWithDatasets.execute(websiteId, { page, pageSize })),
    orNotFound(queries.getDataSourceSetup.execute(websiteId)),
  ]);
  return {
    sources,
    setup,
    items: sources.items.map(toDataSourceDto),
    hrefFor: (target: number) =>
      `${dataSourceRoutes.sources(websiteId)}${buildQueryString({ page: target === 1 ? undefined : target, pageSize: sources.pageSize })}`,
  };
}
