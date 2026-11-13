import { db } from '@lib/db';

import type { BookingScope } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';

/** The handle `db.transaction` passes to its callback. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What a query starts from: the client, or the transaction a write runs in. */
type Source = Pick<Transaction, 'orm'>;

/**
 * Starting points for every booking query: the tenant and the website are part of the statement,
 * so another website's id behaves exactly like an id that does not exist, and a write cannot touch
 * a row outside the scope. Start from these instead of `db.orm.public.*`. Inside a transaction pass
 * the transaction as `source`: a query started from `db` runs outside it, on another connection,
 * and is neither rolled back with it nor part of its locks.
 */
export const bookingsOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.Booking.where({ tenantId, websiteId });

/** The units of the website's bookings (each row carries the `websiteId` of its booking). */
export const assignmentsOf = ({ websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.BookingAssignment.where({ websiteId });

/** The transaction a write runs in, with the scope it is bound to and the moment it happens. */
export interface WriteScope {
  readonly tx: Transaction;
  readonly scope: BookingScope;
  readonly now: Instant;
}

export const servicesOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.BookableService.where({ tenantId, websiteId });

export const serviceLocationsOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.BookableServiceLocation.where({ tenantId, websiteId });

export const resourcesOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.BookableResource.where({ tenantId, websiteId });

export const locationsOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.BookingLocation.where({ tenantId, websiteId });

export const preferencesOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.EmployeePreference.where({ tenantId, websiteId });

export const messagesOf = ({ tenantId, websiteId }: BookingScope, source: Source = db) =>
  source.orm.public.ActorMessage.where({ tenantId, websiteId });
