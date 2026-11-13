import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { toWebsiteId as sourceWebsiteId } from '@modules/data-sources/domain/models/ids';
import { toWebsiteId } from '@modules/release/domain/models/ids';
import { DataSourcesModuleSource } from '@modules/release/infrastructure/source/data-sources-module-source';

import { conflictError } from '@lib/errors';
import { okAsync } from '@lib/result';

function source(isTruncated: boolean) {
  return new DataSourcesModuleSource({
    authorizeRemoval: () =>
      okAsync({
        websiteId: sourceWebsiteId('website-1'),
        actorId: toActorId('actor-1'),
        tenantId: toTenantId('website-1'),
      }),
    usesInStoredPage: () => [],
    draftUsage: () => okAsync({ byDataset: { visible: [] }, isTruncated }),
    mapUsage: () => okAsync({ datasetIds: [] }),
    inUse: () => conflictError('dataset.in_use', 'Used.'),
    deleteDataset: () => okAsync({ id: 'visible', websiteId: 'website-1' }),
    deleteDataSource: () =>
      okAsync({ id: 'source-1', websiteId: 'website-1', removedDatasetIds: [] }),
  });
}

describe('data source release adapter', () => {
  it('fails closed when the builder usage list is incomplete', async () => {
    const result = await source(true).datasetsInDrafts(toWebsiteId('website-1'));
    expect(result._unsafeUnwrapErr().code).toBe('release.source_failed');
  });

  it('preserves the checked ids from a complete draft read', async () => {
    expect([
      ...(await source(false).datasetsInDrafts(toWebsiteId('website-1')))._unsafeUnwrap(),
    ]).toEqual(['visible']);
  });
});
