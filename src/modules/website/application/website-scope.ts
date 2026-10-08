import type { ResourceScope } from '@modules/auth';

import type { Website } from '../domain/models/website';

/**
 * The scope authorization checks a loaded website against. The tenant is
 * read from the stored record (`website.tenantId`), never from the request,
 * which is what makes the cross-tenant check a comparison instead of trust.
 */
export function scopeOf(website: Website): ResourceScope {
  return { tenantId: website.tenantId };
}
