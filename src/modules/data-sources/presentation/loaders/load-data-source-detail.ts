import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';

import { toDataSourceDto } from '../dto/data-source-dto';

import type { DataSourceReaders } from '../../application/contracts/screen-views';

interface LoadDataSourceDetailInput {
  readonly websiteId: string;
  readonly sourceId: string;
  readonly queries: Pick<DataSourceReaders, 'listDataSourcesWithDatasets'>;
}

/**
 * One source with its datasets. The list query already answers the page that holds a source, so the
 * source is found there; one that is not on it (or belongs to another website) is not found.
 */
export async function loadDataSourceDetail({
  websiteId,
  sourceId,
  queries,
}: LoadDataSourceDetailInput) {
  const page = await orNotFound(
    queries.listDataSourcesWithDatasets.execute(websiteId, { sourceId }),
  );
  const source = page.items.find((item) => item.id === sourceId && item.websiteId === websiteId);
  if (source === undefined) {
    notFound();
  }
  return toDataSourceDto(source);
}
