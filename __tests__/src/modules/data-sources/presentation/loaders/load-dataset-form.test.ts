import { describe, expect, it, vi } from 'vitest';

import {
  toDataSourceView,
  toDatasetView,
} from '@modules/data-sources/application/data-source-view-mappers';
import { loadDatasetForm } from '@modules/data-sources/presentation/loaders/load-dataset-form';

import { okAsync } from '@lib/result';

import { DATASET, SOURCE } from '../../support/data-source-fixtures';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

describe('dataset form route ownership', () => {
  it('refuses a source from another website before loading a child', async () => {
    const getDataset = { execute: vi.fn(() => okAsync(toDatasetView(DATASET))) };
    await expect(
      loadDatasetForm(
        { websiteId: 'other', sourceId: SOURCE.id, datasetId: DATASET.id },
        { getDataSource: { execute: () => okAsync(toDataSourceView(SOURCE)) }, getDataset },
      ),
    ).rejects.toThrow('not-found');
    expect(getDataset.execute).not.toHaveBeenCalled();
  });

  it('refuses a child that belongs to a different source', async () => {
    await expect(
      loadDatasetForm(
        { websiteId: SOURCE.websiteId, sourceId: SOURCE.id, datasetId: DATASET.id },
        {
          getDataSource: { execute: () => okAsync(toDataSourceView(SOURCE)) },
          getDataset: {
            execute: () =>
              okAsync({
                ...toDatasetView(DATASET),
                source: { ...DATASET.source, id: 'other-source' },
              }),
          },
        },
      ),
    ).rejects.toThrow('not-found');
  });
});
