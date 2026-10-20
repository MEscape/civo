import { toTenantId } from './ids';

import type { TenantId } from './ids';

/**
 * Where a platform administrator stands when no website is open: a scope
 * with no data of its own. Platform memberships live under it too.
 */
export const PLATFORM_TENANT_ID = toTenantId('platform');

/** Where someone with no membership stands. Holds nothing, so every permission is denied. */
export const UNASSIGNED_TENANT_ID = toTenantId('unassigned');

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Brands a tenant id that arrived with a request, after checking its shape; `null` when it is none.
 * A hint names a website, so the two reserved scopes are no hint: a request cannot place anyone in
 * `platform` or `unassigned` by naming it.
 */
export function parseTenantHint(raw: string | null): TenantId | null {
  if (raw === null || !TENANT_ID_PATTERN.test(raw)) {
    return null;
  }
  const tenantId = toTenantId(raw);
  return tenantId === PLATFORM_TENANT_ID || tenantId === UNASSIGNED_TENANT_ID ? null : tenantId;
}
