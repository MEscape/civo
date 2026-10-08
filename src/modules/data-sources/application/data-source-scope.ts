import type { ResourceScope } from '@modules/auth';

import type { DataSource } from '../domain/models/data-source';
import type { Dataset } from '../domain/models/dataset';

/**
 * The scope authorization checks a loaded record against. The tenant is
 * read from the stored record (`source.tenantId`, or a dataset's tenant
 * read through its source), never from the request, which is what makes the
 * cross-tenant check a comparison instead of trust.
 */
export function scopeOf(record: DataSource | Dataset): ResourceScope {
  return { tenantId: record.tenantId };
}
