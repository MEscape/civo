/**
 * Integration test, against a real Postgres, of changing a stored booking: every change moves the
 * booking, its units and the capacity they hold together or not at all, never overwrites what moved
 * on, and leaves who served a booking on record. The changes are made with the domain's own
 * operations, so the rules and the storage are tested working together. Needs the database of
 * `DATABASE_URL` with the migrations applied: `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import {
  assignResource,
  releaseAssignment,
  replaceAssignment,
} from '@modules/booking/domain/assignment/booking-assignment';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import {
  cancelBooking,
  completeBooking,
  markNoShow,
  rescheduleBooking,
} from '@modules/booking/domain/lifecycle/booking-lifecycle';
import { toBookableResourceId } from '@modules/booking/domain/models/ids';
import type { NewBooking, StoredBooking } from '@modules/booking/domain/ports/booking.repository';

import { employee, schedule, slotAt } from '../support/booking-fixtures';
import { stored } from '../support/persistence-fixtures';
import { NOW, bookings, shifted, useWorld, version } from '../support/persistence-suite';
import { at, between, unwrap } from '../support/time-fixtures';

describe('changing a booking (real Postgres)', () => {
  const suite = useWorld();

  const save = (change: NewBooking, from: NewBooking, now = NOW) =>
    bookings.save(suite.world.scope, { stored: change, expected: version(from), now });

  /** `resourceId` as the domain accepts it for the booking, on a calendar that shows them free all day. */
  async function eligibleFor(target: StoredBooking, resourceId: string, date = '2027-01-11') {
    const service = await suite.service();
    const assessment = assessEligibility({
      now: NOW,
      booking: target.booking,
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
    return assessment.candidate;
  }

  /** The open booking claimed by `resourceId`, as the domain does it. */
  async function claimedBy(open: StoredBooking, resourceId: string, date = '2027-01-11') {
    const candidate = await eligibleFor(open, resourceId, date);
    return unwrap(assignResource({ booking: open.booking, candidate, now: NOW }));
  }

  describe('the compare-and-swap', () => {
    it('refuses a change to a booking that moved on since it was read, and keeps what is there', async () => {
      const current = await suite.store({
        id: 's-stale',
        time: '07:00',
        units: [suite.world.ids.anna],
      });
      const cancelled = unwrap(
        cancelBooking({
          booking: current.booking,
          service: await suite.service(),
          actor: 'manager',
          now: NOW,
        }),
      );
      const change = { ...current, booking: cancelled };

      unwrap(await save(change, current));
      const second = await save(change, current);

      expect(second._unsafeUnwrapErr()).toMatchObject({ code: CODES.bookingStale });
    });

    it('moves the token even when the clock has not: the next writer still sees a change', async () => {
      const current = await suite.store({
        id: 's-token',
        time: '07:30',
        units: [suite.world.ids.anna],
      });

      const saved = unwrap(
        await save({ ...current, booking: { ...current.booking, rescheduleCount: 1 } }, current),
      );

      expect(saved.booking.updatedAt).toBe(current.booking.updatedAt + 1);
    });

    it('says not found for a booking that is not there, and for one of another website', async () => {
      const { world } = suite;
      const ghost = stored(world, { id: 'ghost', time: '09:00', units: [world.ids.anna] });
      const mine = await suite.store({ id: 's-foreign', time: '15:00', units: [world.ids.anna] });

      const missing = await save(ghost, ghost);
      const foreign = await bookings.save(world.otherScope, {
        stored: mine,
        expected: version(mine),
        now: NOW,
      });

      expect(missing._unsafeUnwrapErr()).toMatchObject({ code: CODES.bookingNotFound });
      expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: CODES.bookingNotFound });
    });

    it('keeps the reference, which never changes, whatever the change says', async () => {
      const current = await suite.store({
        id: 's-ref',
        time: '06:30',
        units: [suite.world.ids.anna],
      });
      const other = { ...current, placement: { ...current.placement, reference: 'ZZZZZZZZZZ' } };

      const saved = unwrap(await save(other, current));

      expect(saved.placement.reference).toBe(current.placement.reference);
      expect(
        unwrap(await bookings.findById(suite.world.scope, current.booking.id))?.placement.reference,
      ).toBe(current.placement.reference);
    });

    it('refuses to write a booking that breaks its invariants, and changes nothing', async () => {
      const current = await suite.store({
        id: 's-broken',
        time: '06:00',
        units: [suite.world.ids.anna],
      });

      const result = await save(
        { ...current, booking: { ...current.booking, rescheduleCount: -1 } },
        current,
      );

      expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'infrastructure' });
      expect(
        unwrap(await bookings.findById(suite.world.scope, current.booking.id))?.booking,
      ).toEqual(current.booking);
    });
  });

  describe('ending a booking', () => {
    it('frees the capacity of a cancelled booking and keeps who served it', async () => {
      const { world } = suite;
      const booked = await suite.store({ id: 'c-1', time: '16:00', units: [world.ids.anna] });
      const rival = stored(world, { id: 'c-2', time: '16:00', units: [world.ids.anna] });
      expect((await bookings.create(world.scope, rival, NOW))._unsafeUnwrapErr()).toMatchObject({
        code: CODES.resourceTaken,
      });
      const cancelled = unwrap(
        cancelBooking({
          booking: booked.booking,
          service: await suite.service(),
          actor: 'customer',
          now: NOW,
        }),
      );

      const saved = unwrap(await save({ ...booked, booking: cancelled }, booked));

      expect(saved.booking).toMatchObject({ status: 'cancelled', cancelledBy: 'customer' });
      expect(await suite.unitsOf(saved)).toEqual([
        { requirementIndex: 0, unitIndex: 0, resourceId: world.ids.anna, isActive: false },
      ]);
      expect(unwrap(await bookings.create(world.scope, rival, NOW)).booking.id).toBe(
        rival.booking.id,
      );
    });

    it.each([
      ['completed', completeBooking],
      ['no_show', markNoShow],
    ] as const)('frees the capacity of a booking that ends as %s', async (status, end) => {
      const { world } = suite;
      const booked = await suite.store({
        id: `end-${status}`,
        date: '2027-01-12',
        time: status === 'completed' ? '08:00' : '08:30',
        units: [world.ids.ben],
      });
      const afterwards = at('2027-01-12', '20:00');
      const ended = unwrap(end(booked.booking, afterwards));

      const saved = unwrap(await save({ ...booked, booking: ended }, booked, afterwards));

      expect(saved.booking.status).toBe(status);
      expect((await suite.unitsOf(saved)).every((unit) => !unit.isActive)).toBe(true);
    });
  });

  describe('moving a booking', () => {
    it('frees the old time and takes the new one in one step', async () => {
      const { world } = suite;
      const booked = await suite.store({ id: 'm-1', time: '04:00', units: [world.ids.anna] });
      const service = await suite.service();
      const moved = unwrap(
        rescheduleBooking({
          booking: booked.booking,
          service,
          slot: slotAt(service, '11:30', [[world.ids.anna]], '2027-01-11'),
          actor: 'manager',
          now: NOW,
        }),
      );

      const saved = unwrap(await save({ ...booked, booking: moved }, booked));

      expect(saved.booking).toMatchObject({ start: at('2027-01-11', '11:30'), rescheduleCount: 0 });
      const oldTime = stored(world, { id: 'm-2', time: '04:00', units: [world.ids.anna] });
      const newTime = stored(world, { id: 'm-3', time: '11:30', units: [world.ids.anna] });
      expect(unwrap(await bookings.create(world.scope, oldTime, NOW))).toBeDefined();
      expect((await bookings.create(world.scope, newTime, NOW))._unsafeUnwrapErr()).toMatchObject({
        code: CODES.resourceTaken,
      });
    });

    it('refuses a move onto a time that is taken, and the booking stays where it was', async () => {
      const { world } = suite;
      await suite.store({ id: 'm-busy', time: '14:00', units: [world.ids.anna] });
      const booked = await suite.store({ id: 'm-4', time: '13:00', units: [world.ids.anna] });
      const service = await suite.service();
      const moved = unwrap(
        rescheduleBooking({
          booking: booked.booking,
          service,
          slot: slotAt(service, '14:00', [[world.ids.anna]], '2027-01-11'),
          actor: 'manager',
          now: NOW,
        }),
      );

      const result = await save({ ...booked, booking: moved }, booked);

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
      expect(unwrap(await bookings.findById(world.scope, booked.booking.id))?.booking).toEqual(
        booked.booking,
      );
    });
  });

  describe('claiming and handing back', () => {
    it('fills an open unit by a claim and persists the assignment with the booking', async () => {
      const { world } = suite;
      const open = await suite.store({ id: 'claim-1', time: '10:00', units: [null] });

      const saved = unwrap(
        await save({ ...open, booking: await claimedBy(open, world.ids.ben) }, open),
      );

      expect(saved.booking.assignments[0]?.resourceId).toBe(world.ids.ben);
      expect(await suite.unitsOf(saved)).toEqual([
        { requirementIndex: 0, unitIndex: 0, resourceId: world.ids.ben, isActive: true },
      ]);
      expect(
        unwrap(await bookings.listOpen(world.scope, { now: NOW, limit: 50 })).map(
          ({ booking }) => booking.id,
        ),
      ).not.toContain(open.booking.id);
    });

    it('opens the unit again when the employee hands it back', async () => {
      const { world } = suite;
      const open = await suite.store({ id: 'back-1', time: '09:15', units: [null] });
      const claimed = unwrap(
        await save({ ...open, booking: await claimedBy(open, world.ids.ben) }, open),
      );
      const service = { ...(await suite.service()), assignmentMode: 'open' as const };
      const handedBack = unwrap(
        releaseAssignment({
          booking: claimed.booking,
          service,
          resourceId: toBookableResourceId(world.ids.ben),
          now: NOW,
        }),
      );

      const saved = unwrap(await save({ ...claimed, booking: handedBack }, claimed));

      expect(saved.booking.assignments[0]?.resourceId).toBeNull();
      expect(
        unwrap(await bookings.listOpen(world.scope, { now: NOW, limit: 50 })).map(
          ({ booking }) => booking.id,
        ),
      ).toContain(open.booking.id);
      const benIsFree = stored(world, { id: 'back-2', time: '09:15', units: [world.ids.ben] });
      expect(unwrap(await bookings.create(world.scope, benIsFree, NOW))).toBeDefined();
    });

    it('refuses a claim by an employee who is busy then, and rolls the whole change back', async () => {
      const { world } = suite;
      await suite.store({ id: 'busy-1', time: '14:30', units: [world.ids.ben] });
      const open = await suite.store({ id: 'busy-2', time: '14:30', units: [null] });
      const claimed = {
        ...open.booking,
        assignments: [
          {
            requirementIndex: 0,
            resourceType: 'employee' as const,
            resourceId: toBookableResourceId(world.ids.ben),
            occupied: open.booking.occupied,
          },
        ],
      };

      const result = await save({ ...open, booking: claimed }, open);

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
      const after = unwrap(await bookings.findById(world.scope, open.booking.id));
      expect(after?.booking).toEqual(open.booking);
    });

    it('refuses a replacement whose new employee was taken meanwhile, and keeps the one who was there', async () => {
      const { world } = suite;
      const booked = await suite.store({ id: 'swap', time: '16:30', units: [world.ids.anna] });
      // Ben was free when the manager's request read the calendars; another booking took him since.
      const candidate = await eligibleFor(booked, world.ids.ben);
      await suite.store({ id: 'swap-race', time: '16:30', units: [world.ids.ben] });
      const swapped = unwrap(
        replaceAssignment({
          booking: booked.booking,
          replaced: toBookableResourceId(world.ids.anna),
          candidate,
          now: NOW,
        }),
      );

      const result = await save({ ...booked, booking: swapped }, booked);

      expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
      expect(unwrap(await bookings.findById(world.scope, booked.booking.id))?.booking).toEqual(
        booked.booking,
      );
      expect(await suite.unitsOf(booked)).toEqual([
        { requirementIndex: 0, unitIndex: 0, resourceId: world.ids.anna, isActive: true },
      ]);
    });
  });

  it('writes nothing when a later step of the change fails: the booking row is rolled back with its units', async () => {
    const { world } = suite;
    await suite.store({ id: 'atomic-busy', time: '05:00', units: [world.ids.ben] });
    const booked = await suite.store({ id: 'atomic', time: '05:30', units: [world.ids.anna] });
    const clash = {
      ...booked.booking,
      start: at('2027-01-11', '05:00'),
      end: at('2027-01-11', '05:30'),
      occupied: { start: at('2027-01-11', '05:00'), end: at('2027-01-11', '05:30') },
      assignments: [
        {
          requirementIndex: 0,
          resourceType: 'employee' as const,
          resourceId: toBookableResourceId(world.ids.ben),
          occupied: { start: at('2027-01-11', '05:00'), end: at('2027-01-11', '05:30') },
        },
      ],
      customer: { email: 'changed@example.org' },
    };

    const result = await save({ ...booked, booking: clash }, booked, shifted(1));

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: CODES.resourceTaken });
    expect(unwrap(await bookings.findById(world.scope, booked.booking.id))?.booking).toEqual(
      booked.booking,
    );
    expect(await suite.unitsOf(booked)).toEqual([
      { requirementIndex: 0, unitIndex: 0, resourceId: world.ids.anna, isActive: true },
    ]);
  });
});
