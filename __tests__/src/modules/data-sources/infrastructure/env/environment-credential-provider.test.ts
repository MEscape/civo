import { afterEach, describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { toDataSourceId } from '@modules/data-sources/domain/models/ids';
import { EnvironmentCredentialProvider } from '@modules/data-sources/infrastructure/env/environment-credential-provider';

afterEach(() => vi.unstubAllEnvs());

describe('runtime data source credentials', () => {
  it('reads dynamic names through the real server configuration boundary, outside the startup schema', async () => {
    vi.stubEnv('DATASOURCE_source_1_API_KEY', 'runtime-test-secret');
    const credential = await new EnvironmentCredentialProvider().resolve({
      tenantId: toTenantId('site-1'),
      dataSourceId: toDataSourceId('source-1'),
      authMode: 'API_KEY',
    });
    expect(credential._unsafeUnwrap()).toEqual({ mode: 'API_KEY', secret: 'runtime-test-secret' });
  });

  it('does not fall back to host secrets when an explicit environment was supplied', async () => {
    vi.stubEnv('DATASOURCE_source_1_API_KEY', 'runtime-test-secret');
    const result = await new EnvironmentCredentialProvider({}).resolve({
      tenantId: toTenantId('site-1'),
      dataSourceId: toDataSourceId('source-1'),
      authMode: 'API_KEY',
    });
    expect(result._unsafeUnwrapErr().code).toBe('data_source.credentials_missing');
  });
});
