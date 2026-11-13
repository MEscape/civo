import { describe, expect, it } from 'vitest';

import { UpdateDataSource } from '@modules/data-sources/application/commands/update-data-source';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { dataSourceDependencies, SCOPE, SOURCE } from '../../support/data-source-fixtures';

/** A stored config in the normalized form a save writes. */
const STORED_CONFIG = {
  baseUrl: 'https://example.org/api',
  path: '/',
  authMode: 'NONE',
  method: 'GET',
  requestBody: null,
  recordsPath: null,
  pagination: { kind: 'none' },
};
const CONNECTION = { baseUrl: 'https://example.org/api', authMode: 'NONE' };

function dependencies() {
  const deps = dataSourceDependencies();
  deps.dataSources.findById.mockReturnValue(okAsync({ ...SOURCE, config: STORED_CONFIG }));
  return deps;
}

describe('UpdateDataSource', () => {
  it('renames a source under its own permission, keeps its test result and records the change', async () => {
    const deps = dependencies();
    const view = (
      await new UpdateDataSource(deps).execute({
        dataSourceId: SOURCE.id,
        name: 'City news',
        config: CONNECTION,
      })
    )._unsafeUnwrap();

    expect(view.name).toBe('City news');
    expect(deps.access.authorizeWebsite).toHaveBeenCalledWith(
      'datasource.update',
      SOURCE.websiteId,
    );
    expect(deps.dataSources.update).toHaveBeenCalledWith(SOURCE.id, SCOPE.tenantId, {
      name: 'City news',
      config: STORED_CONFIG,
      resetsCheck: false,
    });
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'data_source.updated',
        dataSourceId: SOURCE.id,
        changedFields: ['name'],
      }),
    );
  });

  it('clears the last test when the connection changes', async () => {
    const deps = dependencies();
    await new UpdateDataSource(deps).execute({
      dataSourceId: SOURCE.id,
      name: SOURCE.name,
      config: { ...CONNECTION, baseUrl: 'https://example.org/v2' },
    });

    expect(deps.dataSources.update).toHaveBeenCalledWith(
      SOURCE.id,
      SCOPE.tenantId,
      expect.objectContaining({ resetsCheck: true }),
    );
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ changedFields: ['config'] }),
    );
  });

  it('stores nothing and records nothing when nothing changed', async () => {
    const deps = dependencies();
    const view = await new UpdateDataSource(deps).execute({
      dataSourceId: SOURCE.id,
      name: SOURCE.name,
      config: CONNECTION,
    });

    expect(view.isOk()).toBe(true);
    expect(deps.dataSources.update).not.toHaveBeenCalled();
    expect(deps.audit.record).not.toHaveBeenCalled();
  });

  it('refuses a connection the outbound policy forbids without storing it', async () => {
    const deps = dependencies();
    const result = await new UpdateDataSource(deps).execute({
      dataSourceId: SOURCE.id,
      name: 'City news',
      config: { baseUrl: 'http://127.0.0.1/admin' },
    });

    expect(result._unsafeUnwrapErr().kind).toBe('validation');
    expect(deps.dataSources.update).not.toHaveBeenCalled();
  });

  it('keeps a source the actor may not edit indistinguishable from a missing one', async () => {
    const deps = dependencies();
    deps.access.authorizeWebsite.mockReturnValue(
      errAsync(forbiddenError('auth.permission_denied', 'Denied.')),
    );
    const result = await new UpdateDataSource(deps).execute({
      dataSourceId: SOURCE.id,
      name: 'City news',
      config: CONNECTION,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(deps.dataSources.findById).not.toHaveBeenCalled();
  });
});
