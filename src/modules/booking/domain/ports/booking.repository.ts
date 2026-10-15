import type { ActorId, TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { Booking } from '../models/booking';
import type { BookingReference } from '../models/booking-reference';
import type {
  BookableResourceId,
  BookableServiceId,
  BookingId,
  BookingLocationId,
  WebsiteId,
} from '../models/ids';
import type { TimeInterval } from '../time/time-interval';

/** A booking about to be stored: everything but what the store assigns. */
export type NewBooking = Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>;

/** What a booking can be about, for asking whether anything still refers to it. */
export type BookingSubject =
  | { readonly kind: 'location'; readonly id: BookingLocationId }
  | { readonly kind: 'service'; readonly id: BookableServiceId }
  | { readonly kind: 'resource'; readonly id: BookableResourceId };

/** A website and the tenant that owns it: every booking query is scoped to both. */
export interface WebsiteScope {
  readonly websiteId: WebsiteId;
  readonly tenantId: TenantId;
}

/** What the operations calendar asks for: a span of start times, narrowed, and bounded. */
export interface CalendarQuery {
  readonly span: TimeInterval;
  readonly filter: BookingFilter;
  readonly limit: number;
  /**
   * Only bookings that occupy a resource assigned to this person. Set for an
   * actor who may read their own bookings only. The store applies it in the
   * same statement as everything else, so what is not theirs never leaves
   * the database, is never counted against `limit`, and cannot be widened by
   * `filter`. Not set: every booking of the website.
   */
  readonly assignedTo?: ActorId | undefined;
}

/** The optional narrowing of the operations calendar. */
export interface BookingFilter {
  readonly locationId?: BookingLocationId | undefined;
  readonly serviceId?: BookableServiceId | undefined;
  readonly resourceId?: BookableResourceId | undefined;
}

/**
 * Persistence for bookings. This port is where double booking is stopped for
 * good: `create` and `save` either hold the resources for the whole occupied
 * span or fail with a conflict, atomically, whatever else is running. The
 * availability check in front of them is advice for good messages; these two
 * are the guarantee.
 */
export interface BookingRepository {
  findById(
    id: BookingId,
    tenantId: TenantId,
  ): AppResultAsync<Booking | null, InfrastructureAppError>;

  /** Looks a booking up by the reference the visitor was given. Callers verify the e-mail address. */
  findByReference(
    reference: BookingReference,
    websiteId: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<Booking | null, InfrastructureAppError>;

  /**
   * Bookings that may block resources in the span: held or confirmed ones
   * whose occupied time overlaps it. A hold past its expiry may still be
   * returned; the engine ignores it. Bounded by `limit`.
   */
  listBlocking(
    scope: WebsiteScope,
    span: TimeInterval,
    limit: number,
  ): AppResultAsync<readonly Booking[], InfrastructureAppError>;

  /** Live and finished bookings starting in the span, for the operations calendar. Bounded by `limit`. */
  listInRange(
    scope: WebsiteScope,
    query: CalendarQuery,
  ): AppResultAsync<readonly Booking[], InfrastructureAppError>;

  /**
   * Stores a new booking and holds its resources. Releases expired holds on
   * those resources first, so a forgotten hold never blocks a real customer.
   * Fails with a conflict when another booking holds a resource in the span
   * (code `booking.conflict`) or the session has no places left (code
   * `booking.capacity_exceeded`).
   */
  create(
    input: NewBooking,
    now: Date,
  ): AppResultAsync<Booking, ConflictAppError | NotFoundAppError | InfrastructureAppError>;

  /**
   * Stores the changed booking, provided the stored one is still the one the
   * change was based on (`expected.updatedAt` and `expected.status` match). A
   * stale base fails with a conflict. The held resources follow the booking:
   * released when it ends, replaced when it moves, re-checked as in `create`.
   */
  save(
    next: Booking,
    expected: Pick<Booking, 'status' | 'updatedAt'>,
    now: Date,
  ): AppResultAsync<Booking, ConflictAppError | NotFoundAppError | InfrastructureAppError>;

  /**
   * Whether any booking, of any status and date, refers to the subject. Such
   * a subject can be switched off but never removed: the booking keeps its
   * history. The caller has loaded the subject within its tenant.
   */
  isReferenced(
    subject: BookingSubject,
    tenantId: TenantId,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /**
   * Whether a booking that still stands (confirmed, or held and not expired)
   * and has not ended refers to the subject: what makes moving a person or
   * taking a service from them something that would strand a visitor.
   */
  hasUpcoming(
    subject: BookingSubject,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<boolean, InfrastructureAppError>;

  /** Bookings of this e-mail address that still stand or are being held. */
  countLiveByEmail(
    scope: WebsiteScope,
    email: string,
    now: Date,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** Holds that have not expired, across the website. */
  countLiveHolds(scope: WebsiteScope, now: Date): AppResultAsync<number, InfrastructureAppError>;

  /** Marks expired holds `expired` and releases what they held. Returns how many. */
  releaseExpiredHolds(
    scope: WebsiteScope,
    now: Date,
    limit: number,
  ): AppResultAsync<number, InfrastructureAppError>;
}
