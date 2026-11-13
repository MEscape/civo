/**
 * Integration test, against a real Postgres, of holds that run out and of the places of a shared
 * session. A hold stops blocking by the clock alone, but the database's constraint knows no clock,
 * so the repository releases expired holds in the way of a newcomer and on request; the sweep must
 * do to a booking exactly what the domain's own `expireHold` does. A shared session has places the
 * constraint cannot count. Needs the database of `DATABASE_URL` with the migrations applied:
 * `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { confirmBooking, expireHold } from '@modules/booking/domain/lifecycle/booking-hold';

import { stored } from '../support/persistence-fixtures';
import { NOW, bookings, hold, shifted, useWorld, version } from '../support/persistence-suite';
import { unwrap } from '../support/time-fixtures';

describe('holds and sessions (real Postgres)', () => {
  const suite = useWorld();

  describe('holds that ran out', () => {
    it('does not stand in the way of a booking once it has expired', async () => {
      const { world } = suite;
      await suite.store({
        id: 'h-dead',
        date: '2027-05-03',
        time: '09:00',
        units: [world.ids.anna],
        overrides: hold(-1),
      });

      const taker = await bookings.create(
        world.scope,
        stored(world, {
          id: 'h-taker',
          date: '2027-05-03',
          time: '09:00',
          units: [world.ids.anna],
        }),
        NOW,
      );

      expect(taker.isOk()).toBe(true);
      const swept = unwrap(await bookings.findById(world.scope, suite.idOf('h-dead')));
      expect(swept?.booking).toMatchObject({ status: 'expired', holdExpiresAt: null });
    });

    it('still stands in the way while it is live', async () => {
      const { world } = suite;
      await suite.store({
        id: 'h-live',
        date: '2027-05-04',
        time: '09:00',
        units: [world.ids.anna],
        overrides: hold(10),
      });

      const taker = await bookings.create(
        world.scope,
        stored(world, { id: 'h-nope', date: '2027-05-04', time: '09:00', units: [world.ids.anna] }),
        NOW,
      );

      expect(taker._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
    });

    it('releases expired holds in bulk, and does to a booking what the domain does', async () => {
      const { world } = suite;
      const dead = await suite.store({
        id: 'sweep-dead',
        date: '2027-05-05',
        time: '09:00',
        units: [world.ids.ben],
        overrides: hold(-30),
      });
      const live = await suite.store({
        id: 'sweep-live',
        date: '2027-05-05',
        time: '10:00',
        units: [world.ids.ben],
        overrides: hold(30),
      });
      const byTheRules = unwrap(expireHold(dead.booking, NOW));
      expect(expireHold(live.booking, NOW).isErr()).toBe(true);

      const released = unwrap(await bookings.releaseExpiredHolds(world.scope, NOW, 100));

      expect(released).toBeGreaterThanOrEqual(1);
      const afterSweep = unwrap(await bookings.findById(world.scope, dead.booking.id));
      expect(afterSweep?.booking).toEqual(byTheRules);
      expect(unwrap(await bookings.findById(world.scope, live.booking.id))?.booking.status).toBe(
        'held',
      );
      expect(await suite.unitsOf(dead)).toEqual([
        { requirementIndex: 0, unitIndex: 0, resourceId: world.ids.ben, isActive: false },
      ]);
    });

    it('is not released again: a second sweep finds nothing left of it', async () => {
      const { world } = suite;
      await suite.store({
        id: 'twice-dead',
        date: '2027-05-06',
        time: '09:00',
        units: [world.ids.ben],
        overrides: hold(-30),
      });

      const first = unwrap(await bookings.releaseExpiredHolds(world.scope, NOW, 100));
      const second = unwrap(await bookings.releaseExpiredHolds(world.scope, NOW, 100));

      expect(first).toBeGreaterThanOrEqual(1);
      expect(second).toBe(0);
    });

    it('can still be confirmed in time, and is then no longer a hold for the sweep', async () => {
      const { world } = suite;
      const held = await suite.store({
        id: 'confirm',
        date: '2027-05-07',
        time: '09:00',
        units: [world.ids.ben],
        overrides: hold(10),
      });
      const confirmed = unwrap(
        confirmBooking({
          booking: held.booking,
          service: await suite.service(),
          customer: { firstName: 'Julia', email: 'julia@example.org' },
          now: NOW,
        }),
      );

      const saved = unwrap(
        await bookings.save(world.scope, {
          stored: { ...held, booking: confirmed },
          expected: version(held),
          now: NOW,
        }),
      );
      unwrap(await bookings.releaseExpiredHolds(world.scope, shifted(24 * 60), 100));

      expect(saved.booking).toMatchObject({ status: 'confirmed', holdExpiresAt: null });
      expect(unwrap(await bookings.findById(world.scope, held.booking.id))?.booking.status).toBe(
        'confirmed',
      );
    });
  });

  describe('shared sessions', () => {
    const session = (n: string) => `session:class:${n}`;

    it('lets bookings of one session share their resources, up to its places', async () => {
      const { world } = suite;
      const spec = (id: string, participants: number) => ({
        id,
        date: '2027-06-01',
        time: '09:00',
        units: [world.ids.room],
        sessionKey: session('class'),
        participants,
        sessionCapacity: 4,
      });

      expect(
        (await bookings.create(world.scope, stored(world, spec('class-1', 2)), NOW)).isOk(),
      ).toBe(true);
      expect(
        (await bookings.create(world.scope, stored(world, spec('class-2', 2)), NOW)).isOk(),
      ).toBe(true);
      const full = await bookings.create(world.scope, stored(world, spec('class-3', 1)), NOW);

      expect(full._unsafeUnwrapErr()).toMatchObject({ code: CODES.capacityExceeded });
    });

    it('gives the place of a cancelled member back to the session', async () => {
      const { world } = suite;
      const spec = {
        date: '2027-06-04',
        time: '09:00',
        units: [world.ids.room],
        sessionKey: session('give-back'),
        sessionCapacity: 1,
      };
      const first = await suite.store({ id: 'gb-1', ...spec });
      expect(
        (
          await bookings.create(world.scope, stored(world, { id: 'gb-2', ...spec }), NOW)
        )._unsafeUnwrapErr(),
      ).toMatchObject({
        code: CODES.capacityExceeded,
      });
      const cancelled = {
        ...first.booking,
        status: 'cancelled' as const,
        cancelledAt: NOW,
        cancelledBy: 'customer' as const,
      };
      unwrap(
        await bookings.save(world.scope, {
          stored: { ...first, booking: cancelled },
          expected: version(first),
          now: NOW,
        }),
      );

      const second = await bookings.create(
        world.scope,
        stored(world, { id: 'gb-2', ...spec }),
        NOW,
      );

      expect(second.isOk()).toBe(true);
    });

    it('refuses to hold one session on two different resources', async () => {
      const { world } = suite;
      await suite.store({
        id: 'split-1',
        date: '2027-06-02',
        time: '09:00',
        units: [world.ids.room],
        sessionKey: session('split'),
        sessionCapacity: 4,
      });

      const split = await bookings.create(
        world.scope,
        stored(world, {
          id: 'split-2',
          date: '2027-06-02',
          time: '09:00',
          units: [world.ids.anna],
          sessionKey: session('split'),
          sessionCapacity: 4,
        }),
        NOW,
      );

      expect(split._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
    });

    it('does not let two private sessions share a resource at the same time', async () => {
      const { world } = suite;
      await suite.store({
        id: 'private-1',
        date: '2027-06-03',
        time: '09:00',
        units: [world.ids.room],
      });

      const second = await bookings.create(
        world.scope,
        stored(world, {
          id: 'private-2',
          date: '2027-06-03',
          time: '09:00',
          units: [world.ids.room],
        }),
        NOW,
      );

      expect(second._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
    });
  });
});
