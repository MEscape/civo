import { describe, expect, it } from 'vitest';

import { ListCompatibleDatasets } from '@modules/data-sources/application/queries/list-compatible-datasets';
import { ListDataSourcesWithDatasets } from '@modules/data-sources/application/queries/list-data-sources-with-datasets';

import { forbiddenError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { dataSourceDependencies, SOURCE, DATASET, SCOPE } from '../../support/data-source-fixtures';

describe('bounded data source reads', () => {
  it('opens the page containing the saved source and keeps truncation metadata', async () => {
    const deps = dataSourceDependencies();
    deps.dataSources.pageOfSource.mockReturnValue(okAsync(3));
    deps.dataSources.listWithDatasets.mockImplementation((_website, _tenant, slice) =>
      okAsync(
        toPage(
          [{ source: SOURCE, datasets: [DATASET], isDatasetListTruncated: true }],
          25,
          slice.page,
        ),
      ),
    );
    const result = await new ListDataSourcesWithDatasets(deps).execute(SOURCE.websiteId, {
      sourceId: SOURCE.id,
    });
    expect(result._unsafeUnwrap().page).toBe(3);
    expect(result._unsafeUnwrap().items[0]?.isDatasetListTruncated).toBe(true);
    expect(deps.dataSources.listWithDatasets).toHaveBeenCalledWith(
      SCOPE.websiteId,
      SCOPE.tenantId,
      expect.objectContaining({ page: { page: 3, pageSize: 10 } }),
    );
  });

  it('requires both source and dataset read authority before reading the list', async () => {
    const deps = dataSourceDependencies();
    deps.access.authorizeWebsite.mockImplementation((permission) =>
      permission === 'dataset.read'
        ? errAsync(forbiddenError('auth.permission_denied', 'Denied.'))
        : okAsync(SCOPE),
    );
    expect((await new ListDataSourcesWithDatasets(deps).execute(SOURCE.websiteId)).isErr()).toBe(
      true,
    );
    expect(deps.dataSources.listWithDatasets).not.toHaveBeenCalled();
  });

  it('preserves compatible-choice truncation for builder and map consumers', async () => {
    const deps = dataSourceDependencies();
    deps.datasets.listCompatible.mockReturnValue(okAsync({ items: [DATASET], isTruncated: true }));
    const view = (
      await new ListCompatibleDatasets(deps).execute({
        websiteId: SOURCE.websiteId,
        canonicalKinds: ['NewsItem'],
      })
    )._unsafeUnwrap();
    expect(view.items.map((item) => item.id)).toEqual([DATASET.id]);
    expect(view.isTruncated).toBe(true);
  });
});
