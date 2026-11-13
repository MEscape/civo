/**
 * Integration test, against a real Postgres, of the queries of the booking repository: what blocks
 * a span, what a calendar lists, what still waits for an employee. Every list is bounded, bound to
 * its website, and honest about being cut. Needs the database of `DATABASE_URL` with the migrations
 * applied: `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { cancelBooking } from '@modules/booking/domain/lifecycle/booking-lifecycle';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';

import { NOW, bookings, hold, useWorld, version } from '../support/persistence-suite';
import { at, between, unwrap } from '../support/time-fixtures';

const ALL = ['held', 'confirmed', 'cancelled', 'completed', 'no_show', 'expired'] as const;

describe('booking queries (real Postgres)', () => {
  const suite = useWorld();

  describe('the calendar', () => {
    const FEBRUARY_FIRST = between('2027-02-01', '00:00', '23:59');

    it('lists bookings by the start of the appointment within the span, earliest first, up to the limit', async () => {
      const { world } = suite;
      await suite.store({ id: 'q-1', date: '2027-02-01', time: '09:00', units: [world.ids.anna] });
      await suite.store({ id: 'q-2', date: '2027-02-01', time: '10:00', units: [world.ids.ben] });
      await suite.store({ id: 'q-3', date: '2027-02-02', time: '09:00', units: [world.ids.anna] });

      const day = unwrap(
        await bookings.list(world.scope, { span: FEBRUARY_FIRST, statuses: ALL, limit: 10 }),
      );
      const capped = unwrap(
        await bookings.list(world.scope, { span: FEBRUARY_FIRST, statuses: ALL, limit: 1 }),
      );

      expect(day.map(({ booking }) => booking.id)).toEqual([suite.idOf('q-1'), suite.idOf('q-2')]);
      expect(capped).toHaveLength(1);
    });

    it('filters by resource, member, customer, location, service and status', async () => {
      const { world } = suite;
      const query = { span: FEBRUARY_FIRST, statuses: ['confirmed' as const], limit: 10 };

      const ofAnna = unwrap(
        await bookings.list(world.scope, {
          ...query,
          resourceId: toBookableResourceId(world.ids.anna),
        }),
      );
      const ofBen = unwrap(
        await bookings.list(world.scope, {
          ...query,
          assignedActorId: toActorId(world.actors.ben),
        }),
      );
      const ofJulia = unwrap(
        await bookings.list(world.scope, {
          ...query,
          customerEmail: ' JULIA@example.org ',
          locationId: world.locationId,
          serviceId: world.serviceId,
        }),
      );
      const cancelled = unwrap(
        await bookings.list(world.scope, { ...query, statuses: ['cancelled'] }),
      );
      const noStatus = unwrap(await bookings.list(world.scope, { ...query, statuses: [] }));

      expect(ofAnna.map(({ booking }) => booking.id)).toEqual([suite.idOf('q-1')]);
      expect(ofBen.map(({ booking }) => booking.id)).toEqual([suite.idOf('q-2')]);
      expect(ofJulia).toHaveLength(2);
      expect(cancelled).toEqual([]);
      expect(noStatus).toEqual([]);
    });
  });

  describe('what blocks a span', () => {
    const MARCH_FIRST = between('2027-03-01', '00:00', '23:59');

    it('lists confirmed bookings and live holds, never cancelled or expired ones', async () => {
      const { world } = suite;
      await suite.store({
        id: 'b-confirmed',
        date: '2027-03-01',
        time: '09:00',
        units: [world.ids.anna],
      });
      await suite.store({
        id: 'b-live-hold',
        date: '2027-03-01',
        time: '10:00',
        units: [world.ids.anna],
        overrides: hold(15),
      });
      await suite.store({
        id: 'b-dead-hold',
        date: '2027-03-01',
        time: '11:00',
        units: [world.ids.anna],
        overrides: hold(-5),
      });
      const cancelled = await suite.store({
        id: 'b-cancelled',
        date: '2027-03-01',
        time: '12:00',
        units: [world.ids.anna],
      });
      const cancelledBooking = unwrap(
        cancelBooking({
          booking: cancelled.booking,
          service: await suite.service(),
          actor: 'manager',
          now: NOW,
        }),
      );
      unwrap(
        await bookings.save(world.scope, {
          stored: { ...cancelled, booking: cancelledBooking },
          expected: version(cancelled),
          now: NOW,
        }),
      );

      const { bookings: blocking, isComplete } = unwrap(
        await bookings.listBlocking(world.scope, { span: MARCH_FIRST, now: NOW, limit: 10 }),
      );

      expect(blocking.map(({ booking }) => booking.id)).toEqual([
        suite.idOf('b-confirmed'),
        suite.idOf('b-live-hold'),
      ]);
      expect(isComplete).toBe(true);
    });

    it('treats the span as half open: a booking that ends where the span starts does not block it', async () => {
      const edge = unwrap(
        await bookings.listBlocking(suite.world.scope, {
          span: between('2027-03-01', '09:30', '10:00'),
          now: NOW,
          limit: 10,
        }),
      );

      expect(edge.bookings).toEqual([]);
      expect(edge.isComplete).toBe(true);
    });

    it('says when the list is cut, so nobody offers times from a partial picture', async () => {
      const cut = unwrap(
        await bookings.listBlocking(suite.world.scope, { span: MARCH_FIRST, now: NOW, limit: 1 }),
      );

      expect(cut.bookings).toHaveLength(1);
      expect(cut.isComplete).toBe(false);
    });

    it('keeps the earliest ones when it cuts, holds and confirmed bookings alike', async () => {
      const cut = unwrap(
        await bookings.listBlocking(suite.world.scope, { span: MARCH_FIRST, now: NOW, limit: 1 }),
      );

      expect(cut.bookings[0]?.booking.id).toBe(suite.idOf('b-confirmed'));
    });
  });

  describe('bookings that wait for an employee', () => {
    it('lists only confirmed bookings that have not ended and still have an open unit', async () => {
      const { world } = suite;
      await suite.store({ id: 'o-open', date: '2027-04-01', time: '09:00', units: [null] });
      await suite.store({
        id: 'o-taken',
        date: '2027-04-01',
        time: '10:00',
        units: [world.ids.anna],
      });
      await suite.store({ id: 'o-later', date: '2027-04-01', time: '11:00', units: [null] });
      const mine = (list: ReadonlyArray<{ booking: { id: string } }>) =>
        list.map(({ booking }) => booking.id).filter((id) => id.includes('-o-'));

      const open = unwrap(await bookings.listOpen(world.scope, { now: NOW, limit: 50 }));
      const later = unwrap(
        await bookings.listOpen(world.scope, { now: at('2027-04-01', '11:15'), limit: 50 }),
      );
      const elsewhere = unwrap(
        await bookings.listOpen(world.scope, {
          now: NOW,
          limit: 50,
          locationId: world.locationId,
        }),
      );

      expect(mine(open)).toEqual([suite.idOf('o-open'), suite.idOf('o-later')]);
      expect(mine(later)).toEqual([suite.idOf('o-later')]);
      expect(mine(elsewhere)).toEqual(mine(open));
    });
  });

  describe('another website', () => {
    it('sees nothing of this one, whatever the query', async () => {
      const { world } = suite;
      const span = between('2027-02-01', '00:00', '23:59');

      const [listed, blocking, open] = await Promise.all([
        bookings.list(world.otherScope, { span, statuses: ALL, limit: 50 }),
        bookings.listBlocking(world.otherScope, { span, now: NOW, limit: 50 }),
        bookings.listOpen(world.otherScope, { now: NOW, limit: 50 }),
      ]);
      const swept = await bookings.releaseExpiredHolds(world.otherScope, NOW, 50);

      expect(listed._unsafeUnwrap()).toEqual([]);
      expect(blocking._unsafeUnwrap()).toEqual({ bookings: [], isComplete: true });
      expect(open._unsafeUnwrap()).toEqual([]);
      expect(swept._unsafeUnwrap()).toBe(0);
    });
  });
});
