import { afterAll, beforeAll } from 'vitest';

import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import type { NewBooking, StoredBooking } from '@modules/booking/domain/ports/booking.repository';
import { addMinutes, subtractMinutes } from '@modules/booking/domain/time/instant';
import { parseMinutes } from '@modules/booking/domain/time/minutes';
import { PrismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { PrismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { PrismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { PrismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';

import { db } from '@lib/db';

import { closeDatabase, createWorld, stored } from './persistence-fixtures';
import { at, unwrap } from './time-fixtures';

import type { BookingSpec, World } from './persistence-fixtures';

/** The moment every write of the persistence tests happens. */
export const NOW = at('2027-01-10', '12:00');

export const bookings = new PrismaBookingRepository();
export const services = new PrismaBookableServiceRepository();
export const resources = new PrismaBookableResourceRepository();
export const locations = new PrismaBookingLocationRepository();

export function minutesOf(value: number) {
  const minutes = parseMinutes(value);
  if (minutes === null) {
    throw new Error('fixture: minutes');
  }
  return minutes;
}

/** `NOW` moved by a number of minutes, back in time when it is negative. */
export const shifted = (delta: number) =>
  delta >= 0 ? addMinutes(NOW, minutesOf(delta)) : subtractMinutes(NOW, minutesOf(-delta));

/** A hold that runs out `delta` minutes after `NOW`, or ran out that long before. */
export const hold = (delta: number) => ({
  status: 'held' as const,
  customer: null,
  holdExpiresAt: shifted(delta),
});

/** The version a change is made against: what the booking was when it was read. */
export const version = ({ booking }: NewBooking) => ({
  status: booking.status,
  updatedAt: booking.updatedAt,
});

/**
 * A website of its own for one test file, created before its tests and removed after them, with
 * the helpers every persistence test uses. The world is read through `suite.world`, which exists
 * once `beforeAll` has run.
 */
export function useWorld() {
  let current: World | undefined;

  beforeAll(async () => {
    current = await createWorld();
  });

  afterAll(async () => {
    await current?.drop();
    await closeDatabase();
  });

  const suite = {
    get world(): World {
      if (current === undefined) {
        throw new Error('The world exists once beforeAll has run.');
      }
      return current;
    },

    /** Stores `spec` and returns what the repository answers; a refusal fails the test. */
    async store(spec: BookingSpec): Promise<StoredBooking> {
      return (
        await bookings.create(suite.world.scope, stored(suite.world, spec), NOW)
      )._unsafeUnwrap();
    },

    /** The service of the world, as the rules read it. */
    async service(): Promise<BookableService> {
      const found = unwrap(await services.findById(suite.world.scope, suite.world.serviceId));
      if (found === null) {
        throw new Error('fixture: the world has its service');
      }
      return found;
    },

    /** The units of a booking exactly as the database holds them, live or not. */
    async unitsOf(booking: StoredBooking) {
      return db.orm.public.BookingAssignment.where({
        websiteId: suite.world.scope.websiteId,
        bookingId: booking.booking.id,
      })
        .orderBy([(unit) => unit.requirementIndex.asc(), (unit) => unit.unitIndex.asc()])
        .select('requirementIndex', 'unitIndex', 'resourceId', 'isActive')
        .all();
    },

    /** The id the world gives the booking of `spec.id`. */
    idOf(key: string) {
      return stored(suite.world, { id: key, time: '00:00', units: [] }).booking.id;
    },
  };
  return suite;
}
