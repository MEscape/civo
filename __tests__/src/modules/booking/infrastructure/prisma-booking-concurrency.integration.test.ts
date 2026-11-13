/**
 * Integration test of the guarantee that matters most: requests that run at the same time cannot
 * make incompatible reservations. Every case starts several writes together (`Promise.all`) after
 * they have all read the same free calendar, and then looks at what the database kept. Only a real
 * Postgres can show this; a fake repository would prove nothing about locks and constraints. Needs
 * the database of `DATABASE_URL` with the migrations applied: `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import { assignResource } from '@modules/booking/domain/assignment/booking-assignment';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  cancelBooking,
  rescheduleBooking,
} from '@modules/booking/domain/lifecycle/booking-lifecycle';
import type {
  BookingWriteError,
  StoredBooking,
} from '@modules/booking/domain/ports/booking.repository';
import { intervalsOverlap } from '@modules/booking/domain/time/time-interval';

import { db } from '@lib/db';
import type { AppResult } from '@lib/result';

import { employee, schedule, slotAt } from '../support/booking-fixtures';
import { stored } from '../support/persistence-fixtures';
import { NOW, bookings, useWorld } from '../support/persistence-suite';
import { between, unwrap } from '../support/time-fixtures';

const repository = bookings;

type Outcome = AppResult<StoredBooking, BookingWriteError>;

const succeeded = (outcomes: readonly Outcome[]) => outcomes.filter((outcome) => outcome.isOk());
const codesOfFailures = (outcomes: readonly Outcome[]) =>
  outcomes.flatMap((outcome) => (outcome.isErr() ? [outcome.error.code] : []));

describe('concurrent bookings (real Postgres)', () => {
  const suite = useWorld();

  const create = (spec: Parameters<typeof stored>[1]) =>
    repository.create(suite.world.scope, stored(suite.world, spec), NOW);

  const liveUnitsOf = (resourceId: string) =>
    db.orm.public.BookingAssignment.where({ websiteId: suite.world.scope.websiteId, resourceId })
      .where({ isActive: true })
      .select('bookingId', 'occupiedStart', 'occupiedEnd')
      .all();

  describe('one resource, one time', () => {
    it('lets exactly one of many simultaneous bookings of an employee win', async () => {
      const outcomes = await Promise.all(
        Array.from({ length: 8 }, (_, n) =>
          create({
            id: `same-${n}`,
            date: '2027-07-05',
            time: '09:00',
            units: [suite.world.ids.anna],
          }),
        ),
      );

      expect(succeeded(outcomes)).toHaveLength(1);
      expect(codesOfFailures(outcomes)).toEqual(Array(7).fill(CODES.resourceTaken));
      expect(await liveUnitsOf(suite.world.ids.anna)).toHaveLength(1);
    });

    it(
      'keeps starts that overlap only in part from both being accepted',
      { timeout: 30_000 },
      async () => {
        const starts = ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50', '11:00', '11:10'];

        const outcomes = await Promise.all(
          starts.map((time, n) =>
            create({ id: `part-${n}`, date: '2027-07-06', time, units: [suite.world.ids.ben] }),
          ),
        );

        const kept = succeeded(outcomes).map((outcome) => unwrap(outcome).booking.occupied);
        expect(kept.length).toBeGreaterThanOrEqual(1);
        for (const [index, first] of kept.entries()) {
          for (const second of kept.slice(index + 1)) {
            expect(intervalsOverlap(first, second)).toBe(false);
          }
        }
        expect(new Set(codesOfFailures(outcomes))).toEqual(new Set([CODES.resourceTaken]));
      },
    );

    it('accepts back to back bookings of one employee, which only touch', async () => {
      const outcomes = await Promise.all(
        ['13:00', '13:30', '14:00', '14:30'].map((time, n) =>
          create({ id: `edge-${n}`, date: '2027-07-07', time, units: [suite.world.ids.anna] }),
        ),
      );

      expect(succeeded(outcomes)).toHaveLength(4);
    });
  });

  describe('independent capacity', () => {
    it('accepts simultaneous bookings of different resources at the same time', async () => {
      const outcomes = await Promise.all([
        create({
          id: 'ind-anna',
          date: '2027-07-08',
          time: '09:00',
          units: [suite.world.ids.anna],
        }),
        create({ id: 'ind-ben', date: '2027-07-08', time: '09:00', units: [suite.world.ids.ben] }),
        create({
          id: 'ind-room',
          date: '2027-07-08',
          time: '09:00',
          units: [suite.world.ids.room],
        }),
      ]);

      expect(succeeded(outcomes)).toHaveLength(3);
    });

    it('accepts simultaneous bookings of one resource on different days', async () => {
      const outcomes = await Promise.all(
        ['09', '10', '11', '12', '13'].map((day) =>
          create({
            id: `day-${day}`,
            date: `2027-08-${day}`,
            time: '09:00',
            units: [suite.world.ids.anna],
          }),
        ),
      );

      expect(succeeded(outcomes)).toHaveLength(5);
    });
  });

  describe('several resources at once', () => {
    it('does not deadlock when bookings ask for the same resources in opposite orders', async () => {
      for (let round = 0; round < 6; round += 1) {
        const date = `2027-09-${String(round + 1).padStart(2, '0')}`;
        const outcomes = await Promise.all([
          create({
            id: `ab-${round}`,
            date,
            time: '09:00',
            units: [suite.world.ids.anna, suite.world.ids.ben],
          }),
          create({
            id: `ba-${round}`,
            date,
            time: '09:00',
            units: [suite.world.ids.ben, suite.world.ids.anna],
          }),
        ]);

        expect(succeeded(outcomes)).toHaveLength(1);
        expect(codesOfFailures(outcomes)).toEqual([CODES.resourceTaken]);
      }
    });

    it('keeps a refused booking from holding anything: its other resources stay free', async () => {
      const [first, second] = await Promise.all([
        create({
          id: 'all-1',
          date: '2027-10-01',
          time: '09:00',
          units: [suite.world.ids.anna, suite.world.ids.room],
        }),
        create({
          id: 'all-2',
          date: '2027-10-01',
          time: '09:00',
          units: [suite.world.ids.ben, suite.world.ids.room],
        }),
      ]);

      const loser = first.isErr() ? first : second;
      const winner = first.isOk() ? first : second;
      expect(loser.isErr()).toBe(true);
      expect(winner.isOk()).toBe(true);
      const loserEmployee = first.isErr() ? suite.world.ids.anna : suite.world.ids.ben;
      // The refused booking's employee is free again: nothing of its failed write was kept.
      const retry = await create({
        id: 'all-3',
        date: '2027-10-01',
        time: '09:00',
        units: [loserEmployee],
      });
      expect(retry.isOk()).toBe(true);
    });
  });

  describe('changes to one booking', () => {
    async function openBooking(id: string, date: string) {
      return unwrap(await create({ id, date, time: '09:00', units: [null] }));
    }

    const claimBy = async (open: StoredBooking, resourceId: string, date: string) => {
      const service = await suite.service();
      const assessment = assessEligibility({
        now: NOW,
        booking: open.booking,
        requirement: service.requirements[0]!,
        requirementIndex: 0,
        candidate: {
          resource: employee(resourceId, { locationId: suite.world.locationId }),
          schedule: schedule(resourceId, [between(date, '07:00', '18:00')]),
        },
      });
      if (assessment.kind !== 'eligible') {
        throw new Error('fixture: not eligible');
      }
      const claimed = unwrap(
        assignResource({ booking: open.booking, candidate: assessment.candidate, now: NOW }),
      );
      return repository.save(suite.world.scope, {
        stored: { ...open, booking: claimed },
        expected: { status: open.booking.status, updatedAt: open.booking.updatedAt },
        now: NOW,
      });
    };

    it('lets exactly one of two employees claim an open booking', async () => {
      const open = await openBooking('claim', '2027-11-01');

      const outcomes = await Promise.all([
        claimBy(open, suite.world.ids.anna, '2027-11-01'),
        claimBy(open, suite.world.ids.ben, '2027-11-01'),
      ]);

      expect(succeeded(outcomes)).toHaveLength(1);
      expect(codesOfFailures(outcomes)).toEqual([CODES.bookingStale]);
      const after = unwrap(await repository.findById(suite.world.scope, open.booking.id))!;
      expect(after.booking.assignments).toHaveLength(1);
      expect([suite.world.ids.anna, suite.world.ids.ben]).toContain(
        after.booking.assignments[0]?.resourceId,
      );
    });

    it('lets one employee claim two open bookings at once, and refuses the second that overlaps', async () => {
      const first = await openBooking('twice-1', '2027-11-02');
      const second = await openBooking('twice-2', '2027-11-02');

      const outcomes = await Promise.all([
        claimBy(first, suite.world.ids.ben, '2027-11-02'),
        claimBy(second, suite.world.ids.ben, '2027-11-02'),
      ]);

      expect(succeeded(outcomes)).toHaveLength(1);
      expect(codesOfFailures(outcomes)).toEqual([CODES.resourceTaken]);
    });

    it('lets exactly one of a cancellation and a reschedule of the same booking win', async () => {
      const booked = unwrap(
        await create({
          id: 'race',
          date: '2027-11-03',
          time: '09:00',
          units: [suite.world.ids.anna],
        }),
      );
      const service = await suite.service();
      const expected = { status: booked.booking.status, updatedAt: booked.booking.updatedAt };
      const cancelled = unwrap(
        cancelBooking({ booking: booked.booking, service, actor: 'manager', now: NOW }),
      );
      const moved = unwrap(
        rescheduleBooking({
          booking: booked.booking,
          service,
          slot: slotAt(service, '11:00', [[suite.world.ids.anna]], '2027-11-03'),
          actor: 'manager',
          now: NOW,
        }),
      );

      const outcomes = await Promise.all([
        repository.save(suite.world.scope, {
          stored: { ...booked, booking: cancelled },
          expected,
          now: NOW,
        }),
        repository.save(suite.world.scope, {
          stored: { ...booked, booking: moved },
          expected,
          now: NOW,
        }),
      ]);

      expect(succeeded(outcomes)).toHaveLength(1);
      expect(codesOfFailures(outcomes)).toEqual([CODES.bookingStale]);
      const after = unwrap(await repository.findById(suite.world.scope, booked.booking.id))!;
      const winner = unwrap(succeeded(outcomes)[0]!);
      expect(after.booking).toEqual(winner.booking);
    });

    it('does not let a late change overwrite one that already happened', async () => {
      const booked = unwrap(
        await create({
          id: 'late',
          date: '2027-11-04',
          time: '09:00',
          units: [suite.world.ids.anna],
        }),
      );
      const service = await suite.service();
      const expected = { status: booked.booking.status, updatedAt: booked.booking.updatedAt };
      const cancelled = unwrap(
        cancelBooking({ booking: booked.booking, service, actor: 'manager', now: NOW }),
      );
      unwrap(
        await repository.save(suite.world.scope, {
          stored: { ...booked, booking: cancelled },
          expected,
          now: NOW,
        }),
      );

      const late = await repository.save(suite.world.scope, {
        stored: { ...booked, booking: { ...booked.booking, rescheduleCount: 9 } },
        expected,
        now: NOW,
      });

      expect(late._unsafeUnwrapErr()).toMatchObject({ code: CODES.bookingStale });
      expect(
        unwrap(await repository.findById(suite.world.scope, booked.booking.id))!.booking.status,
      ).toBe('cancelled');
    });
  });

  describe('places in a shared session', () => {
    it('never admits more participants than the session has places', async () => {
      const key = `session:${suite.world.serviceId}:crowd`;

      const outcomes = await Promise.all(
        Array.from({ length: 8 }, (_, n) =>
          create({
            id: `crowd-${n}`,
            date: '2027-12-01',
            time: '09:00',
            units: [suite.world.ids.room],
            sessionKey: key,
            participants: 1,
            sessionCapacity: 3,
          }),
        ),
      );

      expect(succeeded(outcomes)).toHaveLength(3);
      expect(new Set(codesOfFailures(outcomes))).toEqual(new Set([CODES.capacityExceeded]));
      const sessionRows = await db.orm.public.Booking.where({
        tenantId: suite.world.scope.tenantId,
        websiteId: suite.world.scope.websiteId,
        sessionKey: key,
      })
        .select('participants')
        .all();
      expect(sessionRows.reduce((sum, row) => sum + row.participants, 0)).toBe(3);
    });
  });
});
