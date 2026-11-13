import { describe, expect, it } from 'vitest';

import {
  PLATFORM_TENANT_ID,
  UNASSIGNED_TENANT_ID,
  parseTenantHint,
  readTenantHint,
} from '@modules/auth/domain/models/tenant';

describe('parseTenantHint', () => {
  it('brands an id of the right shape', () => {
    expect(parseTenantHint('3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59')).toBe(
      '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59',
    );
  });

  it.each([null, '', 'a b', 'a/b', 'x'.repeat(65), '<script>'])('is none for %j', (raw) => {
    expect(parseTenantHint(raw)).toBeNull();
  });

  it('refuses the two reserved scopes: a request cannot place anyone in them by naming them', () => {
    expect(parseTenantHint(PLATFORM_TENANT_ID)).toBeNull();
    expect(parseTenantHint(UNASSIGNED_TENANT_ID)).toBeNull();
  });
});

describe('readTenantHint', () => {
  it('returns the branded tenant id when getTenantHint returns a valid id', async () => {
    const result = await readTenantHint(async () => '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59');
    }
  });

  it('returns null when getTenantHint resolves to null or an invalid string', async () => {
    const nullResult = await readTenantHint(async () => null);
    expect(nullResult.isOk()).toBe(true);
    if (nullResult.isOk()) {
      expect(nullResult.value).toBeNull();
    }

    const invalidResult = await readTenantHint(async () => 'not a valid id');
    expect(invalidResult.isOk()).toBe(true);
    if (invalidResult.isOk()) {
      expect(invalidResult.value).toBeNull();
    }
  });

  it('returns null when getTenantHint rejects or throws synchronously', async () => {
    const rejectedResult = await readTenantHint(async () => {
      throw new Error('Header reading failed');
    });
    expect(rejectedResult.isOk()).toBe(true);
    if (rejectedResult.isOk()) {
      expect(rejectedResult.value).toBeNull();
    }

    const syncThrowResult = await readTenantHint(() => {
      throw new Error('Synchronous throw');
    });
    expect(syncThrowResult.isOk()).toBe(true);
    if (syncThrowResult.isOk()) {
      expect(syncThrowResult.value).toBeNull();
    }
  });

  it('returns null when getTenantHint returns a reserved tenant id', async () => {
    const platformResult = await readTenantHint(async () => PLATFORM_TENANT_ID);
    expect(platformResult.isOk()).toBe(true);
    if (platformResult.isOk()) {
      expect(platformResult.value).toBeNull();
    }
  });
});
