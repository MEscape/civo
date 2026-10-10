import type { TenantId } from '@modules/auth';

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
    websiteId: WebsiteId,
    tenantId: TenantId,
    span: TimeInterval,
    limit: number,
  ): AppResultAsync<readonly Booking[], InfrastructureAppError>;

  /** Live and finished bookings starting in the span, for the operations calendar. Bounded by `limit`. */
  listInRange(
    websiteId: WebsiteId,
    tenantId: TenantId,
    span: TimeInterval,
    filter: BookingFilter,
    limit: number,
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

  /** Bookings of this e-mail address that still stand or are being held. */
  countLiveByEmail(
    websiteId: WebsiteId,
    tenantId: TenantId,
    email: string,
    now: Date,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** Holds that have not expired, across the website. */
  countLiveHolds(
    websiteId: WebsiteId,
    tenantId: TenantId,
    now: Date,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** Marks expired holds `expired` and releases what they held. Returns how many. */
  releaseExpiredHolds(
    websiteId: WebsiteId,
    tenantId: TenantId,
    now: Date,
    limit: number,
  ): AppResultAsync<number, InfrastructureAppError>;
}
