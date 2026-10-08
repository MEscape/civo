import type { TenantId } from '@modules/auth';

import { db } from '@lib/db';

/**
 * Tenant-scoped starting points for every tenant-scoped query.
 *
 * A source has no tenant column: it is owned through its website, and a
 * dataset through its source. The ownership filter is a Prisma 8 relation
 * filter (`.some(...)` on a to-one relation), so it runs INSIDE the
 * statement:
 *
 * - another tenant's id behaves exactly like an id that does not exist;
 * - a write cannot touch a row outside the tenant, and there is no gap
 *   between "check ownership" and "write";
 * - a list needs no filtering afterwards, so `limit` applies to the
 *   tenant's own rows only.
 *
 * Start from these instead of `db.orm.public.*` and the scope cannot be
 * forgotten.
 */
export const dataSourcesOf = (tenantId: TenantId) =>
  db.orm.public.DataSource.where((source) => source.website.some({ tenantId }));

export const datasetsOf = (tenantId: TenantId) =>
  db.orm.public.Dataset.where((dataset) =>
    dataset.dataSource.some((source) => source.website.some({ tenantId })),
  );
