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

/** Brands a tenant id that arrived with a request, after checking its shape; `null` when it is none. */
export function parseTenantHint(raw: string | null): TenantId | null {
  return raw !== null && TENANT_ID_PATTERN.test(raw) ? toTenantId(raw) : null;
}
