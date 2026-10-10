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

/** The handle `db.transaction` passes to its callback. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `create` only when the website belongs to the tenant, and in the same
 * transaction as that check, so the answer cannot change between the two
 * statements. Another tenant's website behaves like one that does not exist
 * (`null`); the foreign key stays the final guard.
 */
export function createInWebsite<T>(
  tenantId: TenantId,
  websiteId: string,
  create: (tx: Transaction) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    const website = await tx.orm.public.Website.where({ id: websiteId, tenantId })
      .select('id')
      .first();
    return website === null ? null : create(tx);
  });
}
