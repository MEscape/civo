import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { loadAuthorizedDataSource } from '@modules/data-sources/application/services/load-authorized-data-source';
import { loadAuthorizedDataset } from '@modules/data-sources/application/services/load-authorized-dataset';

import { forbiddenError, unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { dataSourceDependencies, DATASET, SOURCE, SCOPE } from '../../support/data-source-fixtures';

describe('target-aware data authorization', () => {
  it('uses current authority for the stored target, independently of the selected website', async () => {
    const deps = dataSourceDependencies();
    const loaded = (
      await loadAuthorizedDataSource(deps, SOURCE.id, 'datasource.test')
    )._unsafeUnwrap();
    expect(loaded.scope).toEqual(SCOPE);
    expect(deps.access.authorizeWebsite).toHaveBeenCalledWith('datasource.test', SOURCE.websiteId);
    expect(deps.dataSources.findById).toHaveBeenCalledWith(SOURCE.id, SCOPE.tenantId);
    expect(deps.authorization.requireInTenant).not.toHaveBeenCalled();
  });

  it('authenticates before any routing lookup', async () => {
    const deps = dataSourceDependencies();
    deps.authorization.requireActor.mockReturnValue(
      errAsync(unauthorizedError('auth.unauthenticated', 'Sign in.')),
    );
    expect((await loadAuthorizedDataset(deps, DATASET.id, 'dataset.map')).isErr()).toBe(true);
    expect(deps.datasets.findWebsiteId).not.toHaveBeenCalled();
  });

  it('keeps a denied target indistinguishable from a missing source and never reads its contents', async () => {
    const deps = dataSourceDependencies();
    deps.access.authorizeWebsite.mockReturnValue(
      errAsync(forbiddenError('auth.permission_denied', 'Denied.')),
    );
    const denied = await loadAuthorizedDataSource(deps, SOURCE.id, 'datasource.delete');
    deps.dataSources.findWebsiteId.mockReturnValue(okAsync(null));
    const missing = await loadAuthorizedDataSource(deps, 'missing', 'datasource.delete');
    expect(denied._unsafeUnwrapErr().code).toBe(missing._unsafeUnwrapErr().code);
    expect(deps.dataSources.findById).not.toHaveBeenCalled();
  });

  it('rejects a repository returning contents outside the authorized owner', async () => {
    const deps = dataSourceDependencies();
    deps.datasets.findWithSource.mockReturnValue(
      okAsync({ dataset: { ...DATASET, tenantId: toTenantId('foreign') }, source: SOURCE }),
    );
    expect(
      (await loadAuthorizedDataset(deps, DATASET.id, 'dataset.map'))._unsafeUnwrapErr().kind,
    ).toBe('not_found');
  });
});
