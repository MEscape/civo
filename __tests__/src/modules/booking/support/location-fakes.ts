import { actorHasPermission } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';
import type { LocationAdminDependencies } from '@modules/booking/application/booking-dependencies';
import { locationNotFound, locationStale } from '@modules/booking/domain/errors/booking-errors';
import { toBookingId, toBookingLocationId, toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingLocationId } from '@modules/booking/domain/models/ids';
import type { BookingAccess } from '@modules/booking/domain/ports/booking-access.port';
import type {
  BookingAuditLog,
  BookingEvent,
} from '@modules/booking/domain/ports/booking-audit-log.port';
import type {
  BookingListQuery,
  BookingScope,
  StoredBooking,
} from '@modules/booking/domain/ports/booking.repository';
import type {
  LocationAdminRepository,
  LocationChange,
  LocationListQuery,
  NewLocation,
  StoredLocation,
} from '@modules/booking/domain/ports/location-admin.repository';
import { asInstant, laterOf } from '@modules/booking/domain/time/instant';
import type { Instant } from '@modules/booking/domain/time/instant';

import { forbiddenError, rateLimitedError } from '@lib/errors';
import type { RateLimitFailure, RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { NOW, makeBooking } from './booking-fixtures';

export { NOW };

export const TENANT = toTenantId('tenant-1');
export const OTHER_TENANT = toTenantId('tenant-2');

export function actorOf(role: Role, tenantId = TENANT): Actor {
  return { id: toActorId(`actor-${role}`), tenantId, roles: [role] };
}

const scopeKey = (scope: BookingScope) => `${scope.tenantId}/${scope.websiteId}`;

/** The locations of several websites in memory, with the same rules the database applies: scoped, and compare-and-swap on `updatedAt`. */
export class FakeLocations implements LocationAdminRepository {
  readonly rows = new Map<string, StoredLocation>();
  private sequence = 0;

  private key(scope: BookingScope, id: string) {
    return `${scopeKey(scope)}/${id}`;
  }

  private visible(scope: BookingScope, query: LocationListQuery) {
    const prefix = `${scopeKey(scope)}/`;
    const needle = query.search?.trim().toLowerCase() ?? '';
    return [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, location]) => location)
      .filter((location) => query.isActive === undefined || location.isActive === query.isActive)
      .filter((location) => location.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  count(scope: BookingScope, query: LocationListQuery) {
    return okAsync(this.visible(scope, query).length);
  }

  list(scope: BookingScope, query: LocationListQuery) {
    return okAsync(this.visible(scope, query).slice(query.offset, query.offset + query.limit));
  }

  findById(scope: BookingScope, id: BookingLocationId) {
    return okAsync(this.rows.get(this.key(scope, id)) ?? null);
  }

  create(scope: BookingScope, location: NewLocation, now: Instant) {
    this.sequence += 1;
    const stored: StoredLocation = {
      ...location,
      id: toBookingLocationId(`loc-${this.sequence}`),
      updatedAt: now,
    };
    this.rows.set(this.key(scope, stored.id), stored);
    return okAsync(stored);
  }

  save(scope: BookingScope, { stored, expected, now }: LocationChange) {
    const key = this.key(scope, stored.id);
    const current = this.rows.get(key);
    if (current === undefined) {
      return errAsync(locationNotFound());
    }
    if (current.updatedAt !== expected) {
      return errAsync(locationStale());
    }
    const saved = { ...stored, updatedAt: laterOf(now, asInstant(expected + 1)) };
    this.rows.set(key, saved);
    return okAsync(saved);
  }

  /** Puts a location in place as if it had been stored earlier. */
  seed(scope: BookingScope, location: StoredLocation): StoredLocation {
    this.rows.set(this.key(scope, location.id), location);
    return location;
  }
}

/** Read-only bookings, filtered the way the repository filters them (span of start times, status, location). */
export function fakeBookings(stored: readonly StoredBooking[]) {
  const matching = (query: BookingListQuery) =>
    stored
      .filter(({ booking }) => booking.start >= query.span.start && booking.start < query.span.end)
      .filter(({ booking }) => query.statuses.includes(booking.status))
      .filter(
        ({ booking }) => query.locationId === undefined || booking.locationId === query.locationId,
      )
      .sort((a, b) => a.booking.start - b.booking.start);
  return {
    list: (_scope: BookingScope, query: BookingListQuery) =>
      okAsync(matching(query).slice(query.offset ?? 0, (query.offset ?? 0) + query.limit)),
    count: (_scope: BookingScope, query: BookingListQuery) => okAsync(matching(query).length),
  };
}

/** A confirmed booking at a location, from `start` to `end`, as the repository would answer it. */
export function storedBooking(
  id: string,
  locationId: BookingLocationId,
  start: Instant,
  end: Instant,
): StoredBooking {
  return {
    tenantId: TENANT,
    booking: makeBooking({
      id: toBookingId(id),
      locationId,
      start,
      end,
      occupied: { start, end },
    }),
    placement: {
      reference: id.toUpperCase(),
      participants: 1,
      sessionKey: `booking:${id}`,
      sessionCapacity: 1,
      snapshot: null,
    },
  };
}

export interface LocationWorld {
  readonly deps: LocationAdminDependencies;
  readonly locations: FakeLocations;
  readonly events: BookingEvent[];
  readonly enforced: string[];
  /** The next calls are made by this person; `null` is nobody signed in. */
  actAs(actor: Actor | null): void;
  limitTo(allowed: number): void;
  setNow(now: Instant): void;
  setBookings(stored: readonly StoredBooking[]): void;
}

export function createLocationWorld(): LocationWorld {
  let current: Actor | null = actorOf('admin');
  let remaining = Number.POSITIVE_INFINITY;
  let now = NOW;
  let bookings = fakeBookings([]);
  const events: BookingEvent[] = [];
  const enforced: string[] = [];
  const locations = new FakeLocations();

  const access: BookingAccess = {
    authorizeWebsite: (permission, rawWebsiteId) =>
      current !== null &&
      rawWebsiteId === current.tenantId &&
      actorHasPermission(current, permission)
        ? okAsync({ actor: current, websiteId: toWebsiteId(current.tenantId) })
        : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  };
  const allowance = { limit: 1, remaining: 1, resetAfterSeconds: 1, degraded: false };
  const take = (policyId: string) => {
    enforced.push(policyId);
    if (remaining <= 0) {
      return errAsync(rateLimitedError('rate_limit.exceeded', 'Slow down.', 30));
    }
    remaining -= 1;
    return okAsync(allowance);
  };
  const rateLimiter: RateLimiter = {
    enforce: ({ policy }) => take(policy.id),
    enforceAll: (requests) =>
      requests.reduce(
        (done, { policy }) => done.andThen((list) => take(policy.id).map((one) => [...list, one])),
        okAsync<ReadonlyArray<typeof allowance>, RateLimitFailure>([]),
      ),
  };
  const audit: BookingAuditLog = { record: (event) => void events.push(event) };

  const deps: LocationAdminDependencies = {
    access,
    rateLimiter,
    audit,
    clock: { now: () => new Date(now) },
    locations,
    // Read through the current set, so a test can change the bookings after the world is built.
    bookings: {
      list: (scope, query) => bookings.list(scope, query),
      count: (scope, query) => bookings.count(scope, query),
    },
  };

  return {
    deps,
    locations,
    events,
    enforced,
    actAs: (actor) => {
      current = actor;
    },
    limitTo: (allowed) => {
      remaining = allowed;
    },
    setNow: (instant) => {
      now = instant;
    },
    setBookings: (stored) => {
      bookings = fakeBookings(stored);
    },
  };
}
