import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';
import { MAX_CALENDAR_BOOKINGS_PER_QUERY } from '@modules/booking/application/booking-limits';
import { CancelBookingAsStaff } from '@modules/booking/application/commands/cancel-booking-as-staff';
import { CompleteBooking } from '@modules/booking/application/commands/complete-booking';
import { MarkBookingNoShow } from '@modules/booking/application/commands/mark-booking-no-show';
import { RescheduleBookingAsStaff } from '@modules/booking/application/commands/reschedule-booking-as-staff';
import type { GetOperationsCalendarInput } from '@modules/booking/application/contracts/booking-inputs';
import { GetBookingOptions } from '@modules/booking/application/queries/get-booking-options';
import { GetOperationsCalendar } from '@modules/booking/application/queries/get-operations-calendar';
import { GetOwnProfile } from '@modules/booking/application/queries/get-own-profile';

import { actorWithRole } from '../support/fakes';
import { TENANT, WEBSITE, at, makeBooking, makeResource } from '../support/fixtures';
import { createWorld } from '../support/world';

const MINUTE = 60_000;
const RANGE = { websiteId: WEBSITE, from: '2027-01-04', to: '2027-01-08' };

const ANNA = 'actor-anna';
const BEN = 'actor-ben';
const resourceOf = (id: string, actor: string | null) =>
  makeResource(id, { assignedActorId: actor });

/** An employee of the tenant: the stock employee actor, under another id. */
const employee = (id: string) => ({ ...actorWithRole(TENANT, 'employee'), id: toActorId(id) });
const as = (role: Role) => actorWithRole(TENANT, role);

/** Anna's and Ben's calendars, one booking each, and one booking that needs both. */
function team(actor: ReturnType<typeof employee> | ReturnType<typeof as>) {
  const world = createWorld({
    actor,
    resources: [resourceOf('res-anna', ANNA), resourceOf('res-ben', BEN)],
  });
  world.bookings.seed(
    makeBooking({ id: 'anna-1', start: at('2027-01-05', '10:00'), resources: ['res-anna'] }),
  );
  world.bookings.seed(
    makeBooking({ id: 'ben-1', start: at('2027-01-05', '11:00'), resources: ['res-ben'] }),
  );
  world.bookings.seed(
    makeBooking({
      id: 'both-1',
      start: at('2027-01-06', '10:00'),
      resources: ['res-anna', 'res-ben'],
    }),
  );
  return world;
}

const calendarOf = async (
  world: ReturnType<typeof team>,
  input: GetOperationsCalendarInput = RANGE,
) => (await new GetOperationsCalendar(world.admin).execute(input))._unsafeUnwrap();
const idsOf = (view: Awaited<ReturnType<typeof calendarOf>>) =>
  view.bookings.map((booking) => booking.id).sort();

describe('an employee reading bookings', () => {
  it('asks the store for their own bookings only, and nobody else asks that', async () => {
    const own = team(employee(ANNA));
    await calendarOf(own);
    expect(own.bookings.calendarQueries.map((query) => query.assignedTo)).toEqual([ANNA]);

    for (const role of ['admin', 'editor', 'viewer'] as const) {
      const world = team(as(role));
      await calendarOf(world);
      expect(world.bookings.calendarQueries.map((query) => query.assignedTo)).toEqual([undefined]);
    }
  });

  it('gets the bookings on their resources, and the shared ones, and no colleague alone', async () => {
    expect(idsOf(await calendarOf(team(employee(ANNA))))).toEqual(['anna-1', 'both-1']);
    expect(idsOf(await calendarOf(team(employee(BEN))))).toEqual(['ben-1', 'both-1']);
  });

  it('gets only their own resources in the calendar', async () => {
    const view = await calendarOf(team(employee(ANNA)));

    expect(view.resources.map((resource) => resource.id)).toEqual(['res-anna']);
  });

  it('cannot widen the calendar with a filter naming a colleague', async () => {
    const world = team(employee(ANNA));

    const view = await calendarOf(world, { ...RANGE, resourceId: 'res-ben' });

    // Only the booking that also occupies Anna's own resource matches both.
    expect(idsOf(view)).toEqual(['both-1']);
    expect(world.bookings.calendarQueries[0]?.assignedTo).toBe(ANNA);
  });

  it('cannot widen the calendar with a service or location filter either', async () => {
    const world = team(employee(ANNA));
    const service = world.bookings.all()[0]?.serviceId;
    const location = world.bookings.all()[0]?.locationId;

    const view = await calendarOf(world, { ...RANGE, serviceId: service, locationId: location });

    expect(idsOf(view)).toEqual(['anna-1', 'both-1']);
  });

  it('is not crowded out by colleagues: the limit counts only what is theirs', async () => {
    const world = createWorld({
      actor: employee(ANNA),
      resources: [resourceOf('res-anna', ANNA), resourceOf('res-ben', BEN)],
    });
    // More colleague bookings than one query may return, all earlier than Anna's only one.
    const first = at('2027-01-04', '00:00');
    for (let index = 0; index < MAX_CALENDAR_BOOKINGS_PER_QUERY + 5; index += 1) {
      world.bookings.seed(makeBooking({ start: first + index * MINUTE, resources: ['res-ben'] }));
    }
    world.bookings.seed(
      makeBooking({ id: 'anna-late', start: at('2027-01-07', '10:00'), resources: ['res-anna'] }),
    );

    const view = await calendarOf(world);

    expect(idsOf(view)).toEqual(['anna-late']);
  });

  it('sees nothing when no resource is assigned to them', async () => {
    const view = await calendarOf(team(employee('actor-carla')));

    expect(view.bookings).toEqual([]);
    expect(view.resources).toEqual([]);
  });

  it('does not find a resource of the same person in another tenant', async () => {
    const world = team(employee(ANNA));
    const foreign = makeResource('res-foreign', {
      assignedActorId: ANNA,
      tenantId: 'other-tenant' as typeof TENANT,
    });
    world.resources.seed(foreign);
    world.bookings.seed(
      makeBooking({
        id: 'foreign-1',
        start: at('2027-01-05', '12:00'),
        resources: ['res-foreign'],
      }),
    );

    expect(idsOf(await calendarOf(world))).toEqual(['anna-1', 'both-1']);
  });

  it('lists only their own resources, selected by the store', async () => {
    const world = team(employee(ANNA));

    const own = (await new GetOwnProfile(world.admin).execute(WEBSITE))._unsafeUnwrap();

    expect(own.profile?.id).toBe('res-anna');
  });

  it('gets the whole calendar nowhere else: the setup is not theirs to read', async () => {
    const world = team(employee(ANNA));

    const setup = await new GetBookingOptions(world.admin).execute(WEBSITE);

    expect(setup._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});

describe('an employee reaching for one booking', () => {
  const colleagues = ['ben-1', 'anna-1', 'both-1'];

  it.each(colleagues)('cannot cancel, complete, reschedule or close %s', async (bookingId) => {
    const world = team(employee(ANNA));
    const before = world.bookings.get(bookingId);

    const results = await Promise.all([
      new CancelBookingAsStaff(world.admin).execute({ bookingId }),
      new CompleteBooking(world.admin).execute({ bookingId }),
      new MarkBookingNoShow(world.admin).execute({ bookingId }),
      new RescheduleBookingAsStaff(world.admin).execute({
        bookingId,
        start: new Date(at('2027-01-07', '09:00')).toISOString(),
      }),
    ]);

    for (const result of results) {
      expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    }
    expect(world.bookings.get(bookingId)).toEqual(before);
  });
});
