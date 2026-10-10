import type { TenantId } from '@modules/auth';

import { db } from '@lib/db';

/**
 * Tenant-scoped starting points for every booking query. Each table carries
 * its own `tenantId`, so the filter is part of the statement: another
 * tenant's id behaves exactly like an id that does not exist, and a write
 * cannot touch a row outside the tenant. Start from these instead of
 * `db.orm.public.*` and the scope cannot be forgotten.
 */
export const locationsOf = (tenantId: TenantId) =>
  db.orm.public.BookingLocation.where({ tenantId });

export const resourcesOf = (tenantId: TenantId) =>
  db.orm.public.BookableResource.where({ tenantId });

export const servicesOf = (tenantId: TenantId) => db.orm.public.BookableService.where({ tenantId });

export const bookingsOf = (tenantId: TenantId) => db.orm.public.Booking.where({ tenantId });
