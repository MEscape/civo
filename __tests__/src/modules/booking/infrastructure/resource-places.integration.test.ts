/**
 * A resource with several places (a room for two) takes that many overlapping bookings and no
 * more, also when the requests arrive together. The exclusion constraint leaves such units out, so
 * the count under the resource lock is the guarantee; only a real Postgres can show it holds.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { db } from '@lib/db';

import { stored } from '../support/persistence-fixtures';
import { NOW, bookings, useWorld } from '../support/persistence-suite';

describe('a resource with several places (real Postgres)', () => {
  const suite = useWorld();
  let round = 0;

  const setPlaces = (capacity: number) =>
    db.orm.public.BookableResource.where({ id: suite.world.ids.room }).updateAndCount({ capacity });

  const bookRoom = (key: string, time: string, date = '2027-08-02') =>
    bookings.create(
      suite.world.scope,
      stored(suite.world, { id: `${key}-${round}`, date, time, units: [suite.world.ids.room] }),
      NOW,
    );

  const liveRoomUnits = () =>
    db.orm.public.BookingAssignment.where({
      websiteId: suite.world.scope.websiteId,
      resourceId: suite.world.ids.room,
    })
      .where({ isActive: true })
      .select('bookingId', 'usesPlace')
      .all();

  beforeEach(async () => {
    round += 1;
    await db.orm.public.BookingAssignment.where({
      websiteId: suite.world.scope.websiteId,
      resourceId: suite.world.ids.room,
    }).deleteAndCount();
  });

  it('lets exactly as many simultaneous bookings in as the room has places', async () => {
    await setPlaces(2);

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, (_, n) => bookRoom(`same-${n}`, '09:00')),
    );

    expect(outcomes.filter((outcome) => outcome.isOk())).toHaveLength(2);
    expect(outcomes.flatMap((outcome) => (outcome.isErr() ? [outcome.error.code] : []))).toEqual(
      Array(4).fill(CODES.resourceTaken),
    );
    const units = await liveRoomUnits();
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.usesPlace)).toBe(true);
  });

  it('takes a booking at another time when the room is full at one', async () => {
    await setPlaces(2);
    expect((await bookRoom('a', '09:00')).isOk()).toBe(true);
    expect((await bookRoom('b', '09:00')).isOk()).toBe(true);

    expect((await bookRoom('c', '09:00'))._unsafeUnwrapErr().code).toBe(CODES.resourceTaken);
    expect((await bookRoom('d', '13:00')).isOk()).toBe(true);
  });

  it('still counts the places taken before the room was narrowed to one', async () => {
    await setPlaces(2);
    expect((await bookRoom('wide', '09:00')).isOk()).toBe(true);
    await setPlaces(1);

    expect((await bookRoom('narrow', '09:00'))._unsafeUnwrapErr().code).toBe(CODES.resourceTaken);
    const [unit] = await liveRoomUnits();
    expect(unit?.usesPlace).toBe(true);
  });

  it('keeps a room with one place under the exclusion constraint', async () => {
    await setPlaces(1);
    expect((await bookRoom('only', '09:00')).isOk()).toBe(true);

    const [unit] = await liveRoomUnits();
    expect(unit?.usesPlace).toBe(false);
  });
});
