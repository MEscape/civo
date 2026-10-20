import { describe, expect, it } from 'vitest';

import {
  PLATFORM_TENANT_ID,
  UNASSIGNED_TENANT_ID,
  parseTenantHint,
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
