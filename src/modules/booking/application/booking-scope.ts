import type { ResourceScope, TenantId } from '@modules/auth';

/**
 * The scope authorization checks a loaded record against. The tenant is read
 * from the STORED record, never from the request, which is what turns the
 * cross-tenant check into a comparison instead of trust. Every booking
 * record carries the tenant of its website, so one function serves them all.
 */
export function scopeOf(record: { readonly tenantId: TenantId }): ResourceScope {
  return { tenantId: record.tenantId };
}
