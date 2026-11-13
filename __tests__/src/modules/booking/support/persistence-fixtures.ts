import { toTenantId } from '@modules/auth';
import type { Booking, Assignment } from '@modules/booking/domain/models/booking';
import {
  toBookableResourceId,
  toBookableServiceId,
  toBookingId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingScope, NewBooking } from '@modules/booking/domain/ports/booking.repository';
import { appointmentAt, occupiedSpanOf } from '@modules/booking/domain/scheduling/slot-rules';
import type { Instant } from '@modules/booking/domain/time/instant';

import { dateToInstant, db, disconnectDb } from '@lib/db';

import { NOW, STORED_WORKING_WEEK, makeBooking, unitOf } from './booking-fixtures';
import { at, rulesOf } from './time-fixtures';

/** Crockford base 32 without I, L, O, U: what the `Booking_reference_rule` accepts. */
const REFERENCE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomReference(): string {
  return Array.from(
    { length: 10 },
    () => REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)],
  ).join('');
}

/**
 * Everything a booking refers to, created in a website of its own so that tests never meet each
 * other's rows: two employees (with an actor each), a room, a location in Berlin and a service
 * that needs one employee. `drop` removes exactly that website and what hangs below it.
 */
export interface World {
  readonly scope: BookingScope;
  readonly otherScope: BookingScope;
  readonly locationId: ReturnType<typeof toBookingLocationId>;
  readonly serviceId: ReturnType<typeof toBookableServiceId>;
  readonly ids: {
    readonly anna: string;
    readonly ben: string;
    readonly room: string;
    readonly foreign: string;
  };
  readonly actors: { readonly anna: string; readonly ben: string };
  drop(): Promise<void>;
}

const POLICY = {
  isAllowed: true,
  deadlineMinutes: 60,
  allowedActors: ['customer', 'employee', 'manager'],
};

export async function createWorld(): Promise<World> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const site = `it-booking-${suffix}`;
  const otherSite = `it-booking-other-${suffix}`;
  const ids = {
    anna: `${suffix}-anna`,
    ben: `${suffix}-ben`,
    room: `${suffix}-room`,
    foreign: `${suffix}-foreign`,
  };
  const locationId = `${suffix}-loc`;
  const serviceId = `${suffix}-svc`;

  for (const id of [site, otherSite]) {
    // A tenant is its website: the one id serves as both.
    await db.orm.public.Website.create({
      id,
      tenantId: id,
      name: `Site ${id}`,
      slug: id,
      templateKey: 'civic',
    });
    // Published, as public booking needs: a website that is not online takes no bookings.
    const releaseId = `${id}-release`;
    await db.orm.public.WebsiteRelease.create({
      id: releaseId,
      websiteId: id,
      releaseNumber: 1,
      status: 'PUBLISHED',
      snapshot: {},
      snapshotHash: '0'.repeat(64),
      publishedAt: dateToInstant(new Date()),
    });
    await db.orm.public.Website.where({ id }).updateAndCount({ publishedReleaseId: releaseId });
  }
  await db.orm.public.BookingLocation.create({
    id: locationId,
    tenantId: site,
    websiteId: site,
    name: 'Rathaus West',
    timeZone: 'Europe/Berlin',
    openingHours: STORED_WORKING_WEEK,
  });
  const resource = (
    id: string,
    websiteId: string,
    type: 'employee' | 'room',
    extra: { assignedActorId?: string } = {},
  ) =>
    db.orm.public.BookableResource.create({
      id,
      tenantId: websiteId,
      websiteId,
      locationId: websiteId === site ? locationId : null,
      name: id,
      type,
      skills: type === 'employee' ? ['ausweise'] : [],
      ...extra,
    });
  await resource(ids.anna, site, 'employee', { assignedActorId: `actor-${ids.anna}` });
  await resource(ids.ben, site, 'employee', { assignedActorId: `actor-${ids.ben}` });
  await resource(ids.room, site, 'room');
  await resource(ids.foreign, otherSite, 'employee');
  await db.orm.public.BookableService.create({
    id: serviceId,
    tenantId: site,
    websiteId: site,
    name: 'Reisepass',
    durationMinutes: 30,
    slotIntervalMinutes: 30,
    homeLocationId: locationId,
    requirements: [{ resourceType: 'employee', skills: ['ausweise'], count: 1, resourceIds: null }],
    horizonDays: 30,
    cancellation: POLICY,
    rescheduling: POLICY,
    information: [],
    requiredDocuments: [],
  });
  await db.orm.public.BookableServiceLocation.create({
    serviceId,
    locationId,
    tenantId: site,
    websiteId: site,
    resources: [],
  });

  return {
    scope: { tenantId: toTenantId(site), websiteId: toWebsiteId(site) },
    otherScope: { tenantId: toTenantId(otherSite), websiteId: toWebsiteId(otherSite) },
    locationId: toBookingLocationId(locationId),
    serviceId: toBookableServiceId(serviceId),
    ids,
    actors: { anna: `actor-${ids.anna}`, ben: `actor-${ids.ben}` },
    async drop() {
      // Remove bookings before their resources/services: immediate foreign keys do not promise
      // a safe order among the website's separate cascade paths.
      for (const id of [site, otherSite]) {
        await db.transaction(async (tx) => {
          await tx.orm.public.Booking.where({ websiteId: id }).deleteAndCount();
          await tx.orm.public.Website.where({ id }).updateAndCount({ publishedReleaseId: null });
          await tx.orm.public.Website.where({ id }).deleteAndCount();
        });
      }
    },
  };
}

export async function closeDatabase(): Promise<void> {
  await disconnectDb();
}

export interface BookingSpec {
  readonly id: string;
  /** Wall-clock time on Monday 2027-01-11 in Berlin. */
  readonly time: string;
  readonly date?: string;
  readonly units: ReadonlyArray<string | null>;
  readonly overrides?: Partial<Booking>;
  readonly sessionKey?: string;
  readonly participants?: number;
  readonly sessionCapacity?: number;
  readonly reference?: string;
}

/** A confirmed booking of the world's service, alone in its session unless the spec says otherwise. */
export function stored(world: World, spec: BookingSpec): NewBooking {
  const start = at(spec.date ?? '2027-01-11', spec.time);
  const rules = rulesOf();
  const appointment = appointmentAt(start, rules);
  const occupied = occupiedSpanOf(appointment, rules);
  const assignments: Assignment[] = spec.units.map((id) =>
    id === null
      ? unitOf(null, { occupied })
      : unitOf(
          id,
          id === world.ids.room
            ? { resourceType: 'room', requirementIndex: 1, occupied }
            : { occupied },
        ),
  );
  const id = toBookingId(`${world.ids.room}-${spec.id}`);
  const booking = makeBooking({
    id,
    serviceId: world.serviceId,
    locationId: world.locationId,
    start,
    end: appointment.end,
    occupied,
    assignments,
    ...spec.overrides,
  });
  return {
    booking,
    placement: {
      reference: spec.reference ?? randomReference(),
      participants: spec.participants ?? 1,
      sessionKey: spec.sessionKey ?? `booking:${id}`,
      sessionCapacity: spec.sessionCapacity ?? 1,
      snapshot: null,
    },
  };
}

export const asResourceId = toBookableResourceId;
export const FIXTURE_NOW: Instant = NOW;
