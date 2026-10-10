import type { Actor, AuthorizationService, TenantId } from '@modules/auth';
import { toTenantId, actorHasPermission } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import {
  bookingConflict,
  bookingNotFound,
  bookingStale,
  capacityExceeded,
} from '@modules/booking/domain/errors/booking-errors';
import type { BookableResource } from '@modules/booking/domain/models/bookable-resource';
import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import { isBlocking } from '@modules/booking/domain/models/booking';
import type { Booking } from '@modules/booking/domain/models/booking';
import { normalizeEmail } from '@modules/booking/domain/models/booking-customer';
import type { BookingLocation } from '@modules/booking/domain/models/booking-location';
import { toBookingReference } from '@modules/booking/domain/models/booking-reference';
import type { BookingReference } from '@modules/booking/domain/models/booking-reference';
import { toBookingId } from '@modules/booking/domain/models/ids';
import type { WebsiteId } from '@modules/booking/domain/models/ids';
import type { BookableResourceRepository } from '@modules/booking/domain/ports/bookable-resource.repository';
import type { BookableServiceRepository } from '@modules/booking/domain/ports/bookable-service.repository';
import type {
  BookingAuditLog,
  BookingEvent,
} from '@modules/booking/domain/ports/booking-audit-log.port';
import type { BookingLocationRepository } from '@modules/booking/domain/ports/booking-location.repository';
import type {
  BookingNotice,
  BookingNotifier,
} from '@modules/booking/domain/ports/booking-notifier.port';
import type { BookingReferenceGenerator } from '@modules/booking/domain/ports/booking-reference-generator.port';
import type {
  BookingRepository,
  CalendarQuery,
  NewBooking,
  WebsiteScope,
} from '@modules/booking/domain/ports/booking.repository';
import type { WebsiteDirectoryRepository } from '@modules/booking/domain/ports/website-directory.repository';
import type { TimeInterval } from '@modules/booking/domain/time/time-interval';

import type { Clock } from '@lib/clock';
import { forbiddenError } from '@lib/errors';
import type { NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { errAsync, okAsync } from '@lib/result';

/** A clock the test moves by hand. */
export class ManualClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(next: Date): void {
    this.current = next;
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class RecordingAuditLog implements BookingAuditLog {
  readonly events: BookingEvent[] = [];

  record(event: BookingEvent): void {
    this.events.push(event);
  }

  types(): string[] {
    return this.events.map((event) => event.type);
  }
}

/** Remembers what the visitor would have been told. */
export class RecordingNotifier implements BookingNotifier {
  readonly notices: BookingNotice[] = [];

  notify(notice: BookingNotice): AppResultAsync<void, never> {
    this.notices.push(notice);
    return okAsync(undefined);
  }

  kinds(): string[] {
    return this.notices.map((notice) => notice.kind);
  }
}

/** Counts up, so a test knows the reference of the Nth booking. */
export class SequentialReferences implements BookingReferenceGenerator {
  private counter = 0;

  next(): BookingReference {
    this.counter += 1;
    return toBookingReference(`R${String(this.counter).padStart(9, '0')}`);
  }
}

export class InMemoryWebsiteDirectory implements WebsiteDirectoryRepository {
  constructor(private readonly owners: ReadonlyMap<string, TenantId>) {}

  findTenantOf(websiteId: WebsiteId): AppResultAsync<TenantId | null, never> {
    return okAsync(this.owners.get(websiteId) ?? null);
  }
}

class InMemoryConfigRepository<T extends { id: string; tenantId: TenantId; websiteId: WebsiteId }> {
  protected readonly rows = new Map<string, T>();
  private counter = 0;

  protected nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  seed(row: T): void {
    this.rows.set(row.id, row);
  }

  /** Merges a draft into a stored row; another tenant's row is "not found", as in the real repositories. */
  update(id: string, tenantId: TenantId, draft: Partial<T>): AppResultAsync<T, NotFoundAppError> {
    const current = this.rows.get(id);
    if (current?.tenantId !== tenantId) {
      return errAsync(bookingNotFound());
    }
    const next = { ...current, ...draft };
    this.rows.set(id, next);
    return okAsync(next);
  }

  findById(id: string, tenantId: TenantId): AppResultAsync<T | null, never> {
    const row = this.rows.get(id);
    return okAsync(row?.tenantId === tenantId ? row : null);
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly T[], never> {
    return okAsync(
      [...this.rows.values()]
        .filter((row) => row.websiteId === websiteId && row.tenantId === tenantId)
        .slice(0, limit),
    );
  }
}

export class InMemoryLocationRepository
  extends InMemoryConfigRepository<BookingLocation>
  implements BookingLocationRepository
{
  create({
    tenantId,
    draft,
  }: Parameters<BookingLocationRepository['create']>[0]): ReturnType<
    BookingLocationRepository['create']
  > {
    const now = new Date(0);
    const location = {
      ...draft,
      id: this.nextId('location') as BookingLocation['id'],
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(location.id, location);
    return okAsync(location);
  }
}

export class InMemoryResourceRepository
  extends InMemoryConfigRepository<BookableResource>
  implements BookableResourceRepository
{
  create({
    tenantId,
    draft,
  }: Parameters<BookableResourceRepository['create']>[0]): ReturnType<
    BookableResourceRepository['create']
  > {
    const now = new Date(0);
    const resource = {
      ...draft,
      id: this.nextId('resource') as BookableResource['id'],
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(resource.id, resource);
    return okAsync(resource);
  }
}

export class InMemoryServiceRepository
  extends InMemoryConfigRepository<BookableService>
  implements BookableServiceRepository
{
  create({
    tenantId,
    draft,
  }: Parameters<BookableServiceRepository['create']>[0]): ReturnType<
    BookableServiceRepository['create']
  > {
    const now = new Date(0);
    const service = {
      ...draft,
      id: this.nextId('service') as BookableService['id'],
      tenantId,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(service.id, service);
    return okAsync(service);
  }
}

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

function spanOf(booking: Pick<Booking, 'occupiedStart' | 'occupiedEnd'>): TimeInterval {
  return { start: booking.occupiedStart.getTime(), end: booking.occupiedEnd.getTime() };
}

/**
 * A booking store that enforces what the real one does: a resource cannot be
 * held twice in overlapping spans (except within one shared session), a
 * shared session cannot exceed its places, and `save` is a compare-and-swap.
 * The application tests rely on these rules to prove the use cases handle
 * the refusals; the real store proves the rules themselves against Postgres.
 */
export class InMemoryBookingRepository implements BookingRepository {
  private readonly rows = new Map<string, Booking>();
  private counter = 0;

  seed(booking: Booking): void {
    this.rows.set(booking.id, booking);
  }

  all(): readonly Booking[] {
    return [...this.rows.values()];
  }

  get(id: string): Booking | undefined {
    return this.rows.get(id);
  }

  findById(id: string, tenantId: TenantId): AppResultAsync<Booking | null, never> {
    const row = this.rows.get(id);
    return okAsync(row?.tenantId === tenantId ? row : null);
  }

  findByReference(
    reference: BookingReference,
    websiteId: WebsiteId,
    tenantId: TenantId,
  ): AppResultAsync<Booking | null, never> {
    const row = [...this.rows.values()].find(
      (candidate) =>
        candidate.reference === reference &&
        candidate.websiteId === websiteId &&
        candidate.tenantId === tenantId,
    );
    return okAsync(row ?? null);
  }

  listBlocking(
    { websiteId, tenantId }: WebsiteScope,
    span: TimeInterval,
    limit: number,
  ): AppResultAsync<readonly Booking[], never> {
    return okAsync(
      [...this.rows.values()]
        .filter(
          (booking) =>
            booking.websiteId === websiteId &&
            booking.tenantId === tenantId &&
            (booking.status === 'held' || booking.status === 'confirmed') &&
            overlaps(spanOf(booking), span),
        )
        .slice(0, limit),
    );
  }

  listInRange(
    { websiteId, tenantId }: WebsiteScope,
    { span, filter, limit }: CalendarQuery,
  ): AppResultAsync<readonly Booking[], never> {
    return okAsync(
      [...this.rows.values()]
        .filter(
          (booking) =>
            booking.websiteId === websiteId &&
            booking.tenantId === tenantId &&
            ['held', 'confirmed', 'completed', 'no_show'].includes(booking.status) &&
            booking.start.getTime() >= span.start &&
            booking.start.getTime() < span.end &&
            (filter.locationId === undefined || booking.locationId === filter.locationId) &&
            (filter.serviceId === undefined || booking.serviceId === filter.serviceId) &&
            (filter.resourceId === undefined || booking.resourceIds.includes(filter.resourceId)),
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, limit),
    );
  }

  create(input: NewBooking, now: Date): ReturnType<BookingRepository['create']> {
    this.counter += 1;
    const booking: Booking = {
      ...input,
      id: toBookingId(`booking-${this.counter}`),
      createdAt: now,
      updatedAt: now,
    };
    return this.write(booking, now, undefined);
  }

  save(
    next: Booking,
    expected: Pick<Booking, 'status' | 'updatedAt'>,
    now: Date,
  ): ReturnType<BookingRepository['save']> {
    const current = this.rows.get(next.id);
    if (current?.tenantId !== next.tenantId) {
      return errAsync(bookingNotFound());
    }
    if (
      current.status !== expected.status ||
      current.updatedAt.getTime() !== expected.updatedAt.getTime()
    ) {
      return errAsync(bookingStale());
    }
    return this.write({ ...next, updatedAt: now }, now, next.id);
  }

  countLiveByEmail(
    { websiteId, tenantId }: WebsiteScope,
    email: string,
    now: Date,
  ): AppResultAsync<number, never> {
    const wanted = normalizeEmail(email);
    return okAsync(
      [...this.rows.values()].filter(
        (booking) =>
          booking.websiteId === websiteId &&
          booking.tenantId === tenantId &&
          booking.customer !== null &&
          normalizeEmail(booking.customer.email) === wanted &&
          isBlocking(booking, now) &&
          booking.end.getTime() > now.getTime(),
      ).length,
    );
  }

  countLiveHolds({ websiteId, tenantId }: WebsiteScope, now: Date): AppResultAsync<number, never> {
    return okAsync(
      [...this.rows.values()].filter(
        (booking) =>
          booking.websiteId === websiteId &&
          booking.tenantId === tenantId &&
          booking.status === 'held' &&
          isBlocking(booking, now),
      ).length,
    );
  }

  releaseExpiredHolds(
    { websiteId, tenantId }: WebsiteScope,
    now: Date,
    limit: number,
  ): AppResultAsync<number, never> {
    const due = [...this.rows.values()]
      .filter(
        (booking) =>
          booking.websiteId === websiteId &&
          booking.tenantId === tenantId &&
          booking.status === 'held' &&
          !isBlocking(booking, now),
      )
      .slice(0, limit);
    for (const booking of due) {
      this.rows.set(booking.id, { ...booking, status: 'expired', updatedAt: now });
    }
    return okAsync(due.length);
  }

  private write(
    booking: Booking,
    now: Date,
    exceptId: string | undefined,
  ): ReturnType<BookingRepository['create']> {
    const live = booking.status === 'held' || booking.status === 'confirmed';
    if (live) {
      // Expired holds in the way are released first, as the real store does.
      for (const other of this.rows.values()) {
        if (other.status === 'held' && !isBlocking(other, now)) {
          this.rows.set(other.id, { ...other, status: 'expired', updatedAt: now });
        }
      }
      const rivals = [...this.rows.values()].filter(
        (other) =>
          other.id !== exceptId &&
          isBlocking(other, now) &&
          other.resourceIds.some((id) => booking.resourceIds.includes(id)) &&
          overlaps(spanOf(other), spanOf(booking)),
      );
      if (rivals.some((other) => other.sessionKey !== booking.sessionKey)) {
        return errAsync(bookingConflict());
      }
      const taken = rivals.reduce((sum, other) => sum + other.participants, 0);
      if (rivals.length > 0 && taken + booking.participants > booking.sessionCapacity) {
        return errAsync(capacityExceeded());
      }
    }
    this.rows.set(booking.id, booking);
    return okAsync(booking);
  }
}

/** An authorization service for one actor, deciding with the real role table. */
export function authorizationFor(actor: Actor | null): AuthorizationService {
  const denied = () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.'));
  return {
    requireInTenant: (permission) =>
      actor !== null && actorHasPermission(actor, permission) ? okAsync(actor) : denied(),
    requireOnResource: (permission, resource) =>
      actor !== null &&
      actor.tenantId === resource.tenantId &&
      actorHasPermission(actor, permission)
        ? okAsync(actor)
        : denied(),
  };
}

export function actorWithRole(tenantId: TenantId, role: Actor['roles'][number]): Actor {
  return { id: toActorId(`actor-${role}`), tenantId, roles: [role] };
}

export const OTHER_TENANT = toTenantId('tenant-2');
