import type { ActorId, TenantId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AssignmentNotice } from '../models/actor-message';
import type { Booking, BookingStatus } from '../models/booking';
import type {
  BookableResourceId,
  BookableServiceId,
  BookingId,
  BookingLocationId,
  WebsiteId,
} from '../models/ids';
import type { ServiceSnapshot } from '../models/service-snapshot';
import type { Instant } from '../time/instant';
import type { TimeInterval } from '../time/time-interval';

/**
 * Whose bookings a call may see. Every method is bound to one website of one tenant; a booking of
 * another website behaves exactly like one that does not exist.
 */
export interface BookingScope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/**
 * What storage keeps next to a `Booking`, and the rules do not need yet: the code a visitor quotes,
 * the group size, and the session the booking belongs to. Bookings with one `sessionKey` share
 * their resources (a class, a room used by a group); every other booking is alone in its session.
 * `sessionCapacity` is the number of places the session has.
 */
export interface BookingPlacement {
  readonly reference: string;
  readonly participants: number;
  readonly sessionKey: string;
  readonly sessionCapacity: number;
  /** What the service was when the booking was made. `null`: made before it was kept. */
  readonly snapshot: ServiceSnapshot | null;
  /** The language the visitor booked in (`de`), which their messages are written in. Absent: made by staff, or before it was kept. */
  readonly locale?: string;
}

/**
 * A booking as the rules see it, with its placement and the tenant the row belongs to. The
 * repository reads and writes them together; the tenant is what the stored record says, so an
 * authorization check can compare it with the caller's instead of trusting the lookup that found it.
 */
export interface StoredBooking {
  readonly tenantId: TenantId;
  readonly booking: Booking;
  readonly placement: BookingPlacement;
}

/** A booking about to be stored: the tenant is the scope it is written under, so it is not named twice. */
export type NewBooking = Omit<StoredBooking, 'tenantId'>;

/** A new booking and the employees to tell about it, written in the same transaction (as for a change). */
export interface BookingCreation extends NewBooking, Pick<BookingChange, 'notices' | 'actorId'> {}

/** The part of a booking a write compares with what is stored: it is the compare-and-swap token. */
export type BookingVersion = Pick<Booking, 'status' | 'updatedAt'>;

/** Bookings whose appointment starts in `span`, newest filters first. `limit` is required: no list is unbounded. */
export interface BookingListQuery {
  readonly span: TimeInterval;
  readonly statuses: readonly BookingStatus[];
  readonly locationId?: BookingLocationId;
  readonly serviceId?: BookableServiceId;
  /** Bookings that hold this resource. */
  readonly resourceId?: BookableResourceId;
  /** Bookings held by the resource that is this member's calendar (an employee's own bookings). */
  readonly assignedActorId?: ActorId;
  /** Compared case-insensitively. */
  readonly customerEmail?: string;
  /** The code a visitor quotes, exactly. */
  readonly reference?: string;
  /** Whether an employee unit still waits (`open`) or none does (`assigned`); BD-04. */
  readonly assignment?: 'open' | 'assigned';
  /** Required: no list is unbounded. */
  readonly limit: number;
  /** Rows skipped, for a page after the first. */
  readonly offset?: number;
}

/** What a count by state looks at: a list query without its statuses, assignment and page. */
export type BookingCountQuery = Omit<
  BookingListQuery,
  'statuses' | 'assignment' | 'limit' | 'offset'
>;

/** How many bookings of a list are in each status, and how many confirmed ones still wait for an employee. */
export interface BookingStateCounts {
  readonly byStatus: Readonly<Partial<Record<BookingStatus, number>>>;
  readonly openConfirmed: number;
}

/** Confirmed bookings that have not ended and still wait for an employee, earliest first. */
export interface OpenBookingQuery {
  readonly now: Instant;
  readonly locationId?: BookingLocationId;
  readonly limit: number;
}

/** The bookings that occupy their resources somewhere in `span` as of `now`. */
export interface BlockingQuery {
  readonly span: TimeInterval;
  readonly now: Instant;
  /** Only the bookings that hold one of these resources; absent: every booking of the website. */
  readonly resourceIds?: readonly BookableResourceId[];
  readonly limit: number;
}

/**
 * What blocks a span. `isComplete` is false when more than `limit` bookings block it: the list is
 * cut, and an availability computed from it would offer times that are taken, so the caller must
 * not offer any (or ask for a smaller span).
 */
export interface BlockingBookings {
  readonly bookings: readonly StoredBooking[];
  readonly isComplete: boolean;
}

/** A change to a stored booking: what it becomes, and the version it was read at. */
export interface BookingChange {
  readonly stored: NewBooking;
  readonly expected: BookingVersion;
  readonly now: Instant;
  /** The employees to tell what the change does to them, written in the same transaction. */
  readonly notices?: readonly AssignmentNotice[];
  /** Who makes the change: a message to themselves is stored as already read. */
  readonly actorId?: ActorId;
}

/** What a write can answer besides the stored booking. */
export type BookingWriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/**
 * Stores bookings and keeps two writes from making incompatible reservations. It loads and saves;
 * the rules (lifecycle, policy, eligibility) stay in the domain and run before a write. A write
 * still cannot trust them alone, because two requests can read the same free time before either
 * writes, so the database refuses what the rules would have refused:
 *
 * - a resource held by two live bookings of different sessions in overlapping spans
 *   (`booking.resource_taken`);
 * - more participants in a shared session than it has places (`booking.capacity_exceeded`);
 * - a change to a booking that moved on since it was read (`booking.stale`).
 *
 * Every write is one transaction. A conflict is permanent: the caller reads again and decides anew.
 */
export interface BookingRepository {
  findById(
    scope: BookingScope,
    id: BookingId,
  ): AppResultAsync<StoredBooking | null, InfrastructureAppError>;

  findByReference(
    scope: BookingScope,
    reference: string,
  ): AppResultAsync<StoredBooking | null, InfrastructureAppError>;

  /**
   * The bookings that occupy their resources somewhere in `span` as of `now`: confirmed ones, and
   * holds that have not run out. This is what availability is computed from.
   */
  listBlocking(
    scope: BookingScope,
    query: BlockingQuery,
  ): AppResultAsync<BlockingBookings, InfrastructureAppError>;

  list(
    scope: BookingScope,
    query: BookingListQuery,
  ): AppResultAsync<readonly StoredBooking[], InfrastructureAppError>;

  /** How many bookings match `query` (its `limit` and `offset` aside): the total a page control needs. */
  count(
    scope: BookingScope,
    query: BookingListQuery,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** The status counts a list's tabs show, from the same conditions as the list (two statements). */
  countByState(
    scope: BookingScope,
    query: BookingCountQuery,
  ): AppResultAsync<BookingStateCounts, InfrastructureAppError>;

  /** Confirmed bookings that have not ended, and holds that have not run out, made with this address. */
  countLiveByEmail(
    scope: BookingScope,
    email: string,
    now: Instant,
  ): AppResultAsync<number, InfrastructureAppError>;

  /** Holds that have not run out: a cap on what anonymous visitors can reserve and abandon. */
  countLiveHolds(scope: BookingScope, now: Instant): AppResultAsync<number, InfrastructureAppError>;

  listOpen(
    scope: BookingScope,
    query: OpenBookingQuery,
  ): AppResultAsync<readonly StoredBooking[], InfrastructureAppError>;

  /**
   * Stores a new booking with its assignments. Expired holds in the way are released first. The
   * stored `createdAt` and `updatedAt` are `now`, whatever the booking says.
   */
  create(
    scope: BookingScope,
    stored: BookingCreation,
    now: Instant,
  ): AppResultAsync<StoredBooking, BookingWriteError>;

  /**
   * Replaces a stored booking, its assignments included, if it still has the `expected` status and
   * `updatedAt`. Status, span, resources and assignment move together or not at all, so a claim, a
   * hand-back, a reschedule and a cancellation each leave the capacity consistent. `updatedAt`
   * becomes `now`, or one millisecond after the replaced one when the clock is not past it, so
   * the next writer always sees that something changed.
   */
  save(
    scope: BookingScope,
    change: BookingChange,
  ): AppResultAsync<StoredBooking, BookingWriteError>;

  // @truncation none a sweep: the holds it leaves are released by the next call and never block meanwhile
  /**
   * Marks up to `limit` holds that ran out as expired and frees what they held. Returns how many
   * it released. Holds stop blocking by the clock alone; this keeps the stored state in step.
   */
  releaseExpiredHolds(
    scope: BookingScope,
    now: Instant,
    limit: number,
  ): AppResultAsync<number, InfrastructureAppError>;
}
