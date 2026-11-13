import { notFound } from 'next/navigation';

import { orNotFound } from '@lib/errors/or-not-found';

import { toDatasetDto } from '../dto/dataset-dto';

import type { DataSourceReaders } from '../../application/contracts/screen-views';

interface DatasetFormTarget {
  readonly websiteId: string;
  readonly sourceId: string;
  readonly datasetId?: string | undefined;
}

/** The route's parent ids must match stored ownership, including when the actor manages both websites. */
export async function loadDatasetForm(
  target: DatasetFormTarget,
  queries: Pick<DataSourceReaders, 'getDataSource' | 'getDataset'>,
) {
  const source = await orNotFound(queries.getDataSource.execute(target.sourceId));
  if (source.websiteId !== target.websiteId) {
    notFound();
  }
  const dataset =
    target.datasetId === undefined
      ? undefined
      : await orNotFound(queries.getDataset.execute(target.datasetId));
  if (
    dataset !== undefined &&
    (dataset.websiteId !== target.websiteId || dataset.source.id !== source.id)
  ) {
    notFound();
  }
  return { source, dataset: dataset === undefined ? undefined : toDatasetDto(dataset) };
}
