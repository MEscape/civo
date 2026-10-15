import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { BOOKING_SUMMARY_NEXT } from '@modules/booking/application/booking-limits';
import { GetBookingSummary } from '@modules/booking/application/queries/get-booking-summary';

import { actorWithRole } from '../support/fakes';
import { TENANT, at, makeBooking, makeLocation, makeResource } from '../support/fixtures';
import { OTHER_WEBSITE, createWorld } from '../support/world';

// The world's clock is Monday 2027-01-04 07:00 in Berlin.
const admin = () => actorWithRole(TENANT, 'admin');
const summaryOf = async (world: ReturnType<typeof createWorld>) =>
  (await new GetBookingSummary(world.admin).execute('website-1'))._unsafeUnwrap();

describe('the booking summary of the website overview', () => {
  it('counts today and the coming days, and lists the next appointments soonest first', async () => {
    const world = createWorld({ actor: admin() });
    world.bookings.seed(
      makeBooking({ id: 'later', start: at('2027-01-04', '15:00'), resources: ['emp-1'] }),
    );
    world.bookings.seed(
      makeBooking({ id: 'first', start: at('2027-01-04', '09:00'), resources: ['emp-1'] }),
    );
    world.bookings.seed(
      makeBooking({ id: 'friday', start: at('2027-01-08', '09:00'), resources: ['emp-1'] }),
    );
    // Beyond the seven days.
    world.bookings.seed(
      makeBooking({ id: 'far', start: at('2027-01-12', '09:00'), resources: ['emp-1'] }),
    );

    const view = await summaryOf(world);

    expect(view).toMatchObject({ hasLocation: true, today: 2, upcoming: 3, days: 7 });
    expect(view.next.map((booking) => booking.id)).toEqual(['first', 'later', 'friday']);
    expect(view.next[0]?.serviceName).toBe('Passport application');
  });

  it('leaves out what does not hold a place: cancelled bookings and holds', async () => {
    const world = createWorld({ actor: admin() });
    world.bookings.seed(
      makeBooking({
        id: 'gone',
        start: at('2027-01-04', '09:00'),
        resources: ['emp-1'],
        status: 'cancelled',
      }),
    );
    world.bookings.seed(
      makeBooking({
        id: 'hold',
        start: at('2027-01-04', '10:00'),
        resources: ['emp-1'],
        status: 'held',
      }),
    );
    world.bookings.seed(
      makeBooking({ id: 'kept', start: at('2027-01-04', '11:00'), resources: ['emp-1'] }),
    );

    const view = await summaryOf(world);

    expect(view.today).toBe(1);
    expect(view.next.map((booking) => booking.id)).toEqual(['kept']);
  });

  it('counts a finished appointment of today but does not list it as coming', async () => {
    const world = createWorld({ actor: admin() });
    world.clock.set(new Date(at('2027-01-04', '12:00')));
    world.bookings.seed(
      makeBooking({
        id: 'done',
        start: at('2027-01-04', '09:00'),
        resources: ['emp-1'],
        status: 'completed',
      }),
    );
    world.bookings.seed(
      makeBooking({ id: 'soon', start: at('2027-01-04', '14:00'), resources: ['emp-1'] }),
    );

    const view = await summaryOf(world);

    expect(view.today).toBe(2);
    expect(view.upcoming).toBe(1);
    expect(view.next.map((booking) => booking.id)).toEqual(['soon']);
  });

  it('lists no more than the few it is meant to', async () => {
    const world = createWorld({ actor: admin() });
    for (let hour = 8; hour < 8 + BOOKING_SUMMARY_NEXT + 3; hour += 1) {
      world.bookings.seed(
        makeBooking({
          id: `b-${hour}`,
          start: at('2027-01-05', `${String(hour).padStart(2, '0')}:00`),
          resources: ['emp-1'],
        }),
      );
    }

    const view = await summaryOf(world);

    expect(view.next).toHaveLength(BOOKING_SUMMARY_NEXT);
    expect(view.upcoming).toBe(BOOKING_SUMMARY_NEXT + 3);
  });

  it('shows an employee only the bookings on their own resources', async () => {
    const world = createWorld({
      actor: { ...actorWithRole(TENANT, 'employee'), id: toActorId('actor-anna') },
      resources: [
        makeResource('res-anna', { assignedActorId: 'actor-anna' }),
        makeResource('res-ben', { assignedActorId: 'actor-ben' }),
      ],
    });
    world.bookings.seed(
      makeBooking({ id: 'anna', start: at('2027-01-04', '10:00'), resources: ['res-anna'] }),
    );
    world.bookings.seed(
      makeBooking({ id: 'ben', start: at('2027-01-04', '11:00'), resources: ['res-ben'] }),
    );

    const view = await summaryOf(world);

    expect(view.next.map((booking) => booking.id)).toEqual(['anna']);
    expect(world.bookings.calendarQueries.map((query) => query.assignedTo)).toEqual(['actor-anna']);
  });

  it('says there is no calendar to count in while the website has no location', async () => {
    const world = createWorld({
      actor: admin(),
      location: makeLocation({ websiteId: OTHER_WEBSITE }),
    });

    expect(await summaryOf(world)).toMatchObject({
      hasLocation: false,
      today: 0,
      upcoming: 0,
      next: [],
    });
  });

  it('is refused to someone who may not read bookings at all', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'contributor') });

    const result = await new GetBookingSummary(world.admin).execute('website-1');

    expect(result.isErr()).toBe(true);
  });
});
