import type { ResourceScope } from '@modules/auth';

import type { PageSummary } from '../domain/models/page';

/**
 * The scope authorization checks a loaded page against. The tenant is read
 * from the stored record (`page.tenantId`), never from the request, which
 * is what makes the cross-tenant check a comparison instead of trust.
 */
export function scopeOf(page: PageSummary): ResourceScope {
  return { tenantId: page.tenantId };
}
