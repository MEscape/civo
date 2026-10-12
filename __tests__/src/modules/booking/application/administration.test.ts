import { describe, expect, it } from 'vitest';

import type { Role } from '@modules/auth/domain/models/role';
import { CancelBookingAsStaff } from '@modules/booking/application/commands/cancel-booking-as-staff';
import { CompleteBooking } from '@modules/booking/application/commands/complete-booking';
import { CreateBookableResource } from '@modules/booking/application/commands/create-bookable-resource';
import { CreateBookableService } from '@modules/booking/application/commands/create-bookable-service';
import { CreateBookingLocation } from '@modules/booking/application/commands/create-booking-location';
import { MarkBookingNoShow } from '@modules/booking/application/commands/mark-booking-no-show';
import { ReleaseExpiredHolds } from '@modules/booking/application/commands/release-expired-holds';
import { RescheduleBookingAsStaff } from '@modules/booking/application/commands/reschedule-booking-as-staff';
import { UpdateBookableService } from '@modules/booking/application/commands/update-bookable-service';
import { UpdateOwnAvailability } from '@modules/booking/application/commands/update-own-availability';
import type {
  CreateBookableServiceInput,
  CreateBookingLocationInput,
} from '@modules/booking/application/contracts/booking-inputs';
import { GetBookingAccess } from '@modules/booking/application/queries/get-booking-access';
import { GetBookingSetup } from '@modules/booking/application/queries/get-booking-setup';
import { GetOperationsCalendar } from '@modules/booking/application/queries/get-operations-calendar';
import { GetOwnResources } from '@modules/booking/application/queries/get-own-resources';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { OTHER_TENANT, actorWithRole } from '../support/fakes';
import { LOCATION_ID, TENANT, WEBSITE, at, makeBooking, makeResource } from '../support/fixtures';
import { book, hold, iso } from '../support/flow-helpers';
import { createWorld } from '../support/world';

const DAY = { intervals: [{ start: '08:00', end: '18:00' }], breaks: [] };
const WEEK = Array.from({ length: 7 }, () => DAY);

const locationInput = (
  overrides: Partial<CreateBookingLocationInput> = {},
): CreateBookingLocationInput => ({
  websiteId: WEBSITE,
  name: 'Library',
  address: null,
  timeZone: 'Europe/Berlin',
  openingHours: { weekly: WEEK, exceptions: [] },
  isActive: true,
  ...overrides,
});

const serviceInput = (
  overrides: Partial<CreateBookableServiceInput> = {},
): CreateBookableServiceInput => ({
  websiteId: WEBSITE,
  name: 'Residence registration',
  description: null,
  category: 'citizen-services',
  isActive: true,
  durationMinutes: 20,
  preparationMinutes: 0,
  cleanupMinutes: 5,
  slotIntervalMinutes: 20,
  locationIds: [LOCATION_ID],
  requirements: [{ resourceType: 'employee', skills: [], count: 1, resourceIds: null }],
  participantsPerBooking: 1,
  participantsPerSession: 1,
  noticeMinutes: 0,
  horizonDays: 30,
  availability: null,
  cancellation: { isAllowed: true, deadlineMinutes: 60, allowedActors: ['customer', 'staff'] },
  rescheduling: { isAllowed: true, deadlineMinutes: 60, allowedActors: ['customer', 'staff'] },
  information: [{ field: 'email', isRequired: true }],
  requiredDocuments: [],
  instructions: null,
  ...overrides,
});

const as = (role: Role) => actorWithRole(TENANT, role);

describe('who may do what', () => {
  it('refuses everything to someone who is not signed in', async () => {
    const world = createWorld({ actor: null });

    const results = await Promise.all([
      new CreateBookingLocation(world.admin).execute(locationInput()),
      new CreateBookableService(world.admin).execute(serviceInput()),
      new GetBookingSetup(world.admin).execute(WEBSITE),
      new CancelBookingAsStaff(world.admin).execute({ bookingId: 'x' }),
      new ReleaseExpiredHolds(world.admin).execute({ websiteId: WEBSITE }),
    ]);

    for (const result of results) {
      expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    }
  });

  it.each([
    ['viewer', false, false],
    ['editor', true, true],
    ['admin', true, true],
  ] as const)(
    'gives a %s the right to configure: %s, to manage: %s',
    async (role, configure, manage) => {
      const world = createWorld({ actor: as(role) });

      const created = await new CreateBookingLocation(world.admin).execute(locationInput());
      expect(created.isOk()).toBe(configure);

      const released = await new ReleaseExpiredHolds(world.admin).execute({ websiteId: WEBSITE });
      expect(released.isOk()).toBe(manage);

      // Every role that can sign in may look.
      expect((await new GetBookingSetup(world.admin).execute(WEBSITE)).isOk()).toBe(true);
    },
  );

  it("keeps one tenant's staff away from another tenant's bookings", async () => {
    const world = createWorld({ actor: as('admin') });
    const booking = await book(world);
    const stranger = createWorld({ actor: actorWithRole(OTHER_TENANT, 'admin') });
    // The stranger's world shares the booking store: only the tenant check stands in the way.
    const result = await new CancelBookingAsStaff({
      ...stranger.admin,
      bookings: world.bookings,
    }).execute({ bookingId: world.bookings.all()[0]?.id ?? '' });

    expect(booking.status).toBe('confirmed');
    expect(result.isErr()).toBe(true);
    expect(world.bookings.all()[0]?.status).toBe('confirmed');
  });
});

describe('configuring locations, resources and services', () => {
  it('creates a location and records it without any personal data', async () => {
    const world = createWorld({ actor: as('admin') });
    const location = (
      await new CreateBookingLocation(world.admin).execute(locationInput())
    )._unsafeUnwrap();

    expect(location.timeZone).toBe('Europe/Berlin');
    expect(world.audit.types()).toContain('booking.location_created');
    expect(JSON.stringify(world.audit.events)).not.toContain('Library');
  });

  it('reports every invalid field of a location at once', async () => {
    const world = createWorld({ actor: as('admin') });
    const result = await new CreateBookingLocation(world.admin).execute(
      locationInput({ name: '   ', timeZone: 'Mars/Olympus' }),
    );

    const error = result._unsafeUnwrapErr();
    expect(error.kind).toBe('validation');
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors).sort()).toEqual([
      'name',
      'timeZone',
    ]);
  });

  it('refuses a resource at a location that does not exist', async () => {
    const world = createWorld({ actor: as('admin') });
    const result = await new CreateBookableResource(world.admin).execute({
      websiteId: WEBSITE,
      locationId: 'nowhere',
      name: 'Desk 9',
      type: 'service-desk',
      skills: [],
      capacity: null,
      availability: null,
      isActive: true,
    });

    const error = result._unsafeUnwrapErr();
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors)).toEqual(['locationId']);
  });

  it('refuses a service that names a location or a resource that does not exist', async () => {
    const world = createWorld({ actor: as('admin') });
    const create = new CreateBookableService(world.admin);

    const badLocation = await create.execute(serviceInput({ locationIds: ['nowhere'] }));
    const badResource = await create.execute(
      serviceInput({
        requirements: [{ resourceType: 'employee', skills: [], count: 1, resourceIds: ['ghost'] }],
      }),
    );

    expect(badLocation._unsafeUnwrapErr().kind).toBe('validation');
    expect(badResource._unsafeUnwrapErr().kind).toBe('validation');
    expect(world.services.listByWebsite(WEBSITE, TENANT, 10)).toBeDefined();
  });

  it('creates a service, then changes it without changing its identity', async () => {
    const world = createWorld({ actor: as('admin') });
    const created = (
      await new CreateBookableService(world.admin).execute(serviceInput())
    )._unsafeUnwrap();
    const updated = (
      await new UpdateBookableService(world.admin).execute({
        ...serviceInput({ name: 'Residence registration (new)' }),
        id: created.id,
      })
    )._unsafeUnwrap();

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Residence registration (new)');
    expect(world.audit.types()).toEqual(['booking.service_created', 'booking.service_updated']);
  });

  it('lists the configuration for the setup screen', async () => {
    const world = createWorld({ actor: as('viewer') });
    const setup = (await new GetBookingSetup(world.admin).execute(WEBSITE))._unsafeUnwrap();

    expect(setup.locations.map((l) => l.name)).toEqual(['Town hall']);
    expect(setup.resources.map((r) => r.name)).toEqual(['emp-1']);
    expect(setup.services.map((s) => s.name)).toEqual(['Passport application']);
  });
});

describe('the operations calendar', () => {
  it('shows the bookings of a range, in the location time zone', async () => {
    const world = createWorld({ actor: as('viewer') });
    await book(world, iso(at('2027-01-05', '10:00')));
    const calendar = (
      await new GetOperationsCalendar(world.admin).execute({
        websiteId: WEBSITE,
        from: '2027-01-04',
        to: '2027-01-10',
      })
    )._unsafeUnwrap();

    expect(calendar.timeZone).toBe('Europe/Berlin');
    expect(calendar.bookings).toHaveLength(1);
    expect(calendar.bookings[0]?.customerEmail).toBe('ada@example.org');
    expect(calendar.resources.map((r) => r.id)).toEqual(['emp-1']);
  });

  it('leaves out bookings of other days and other resources', async () => {
    const world = createWorld({
      actor: as('viewer'),
      resources: [makeResource('emp-1'), makeResource('emp-2')],
    });
    world.bookings.seed(
      makeBooking({ id: 'b-1', start: at('2027-01-05', '10:00'), resources: ['emp-1'] }),
    );
    world.bookings.seed(
      makeBooking({ id: 'b-2', start: at('2027-01-05', '11:00'), resources: ['emp-2'] }),
    );
    world.bookings.seed(
      makeBooking({ id: 'b-3', start: at('2027-02-01', '11:00'), resources: ['emp-1'] }),
    );
    const calendar = new GetOperationsCalendar(world.admin);

    const week = (
      await calendar.execute({ websiteId: WEBSITE, from: '2027-01-04', to: '2027-01-10' })
    )._unsafeUnwrap();
    const one = (
      await calendar.execute({
        websiteId: WEBSITE,
        from: '2027-01-04',
        to: '2027-01-10',
        resourceId: 'emp-2',
      })
    )._unsafeUnwrap();

    expect(week.bookings.map((b) => b.id).sort()).toEqual(['b-1', 'b-2']);
    expect(one.bookings.map((b) => b.id)).toEqual(['b-2']);
  });

  it('refuses a range longer than the limit', async () => {
    const world = createWorld({ actor: as('viewer') });
    const result = await new GetOperationsCalendar(world.admin).execute({
      websiteId: WEBSITE,
      from: '2027-01-01',
      to: '2027-12-31',
    });

    expect(result._unsafeUnwrapErr().kind).toBe('validation');
  });
});

describe('staff handling a booking', () => {
  it('cancels even when the customer deadline has passed', async () => {
    const world = createWorld({ actor: as('editor') });
    await book(world);
    world.clock.set(new Date(at('2027-01-05', '09:45')));
    const id = world.bookings.all()[0]?.id ?? '';
    const cancelled = (
      await new CancelBookingAsStaff(world.admin).execute({ bookingId: id })
    )._unsafeUnwrap();

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledBy).toBe('staff');
  });

  it('moves a booking to a free time, without the customer limits', async () => {
    const world = createWorld({ actor: as('editor') });
    await book(world);
    const id = world.bookings.all()[0]?.id ?? '';
    const moved = (
      await new RescheduleBookingAsStaff(world.admin).execute({
        bookingId: id,
        start: iso(at('2027-01-06', '15:00')),
      })
    )._unsafeUnwrap();

    expect(moved.start.getTime()).toBe(at('2027-01-06', '15:00'));
  });

  it('refuses a move onto a time when nobody is free', async () => {
    const world = createWorld({ actor: as('editor') });
    await book(world);
    await book(world, iso(at('2027-01-06', '15:00')), 'grace@example.org');
    const mine = world.bookings.all().find((b) => b.start.getTime() === at('2027-01-05', '10:00'));
    const result = await new RescheduleBookingAsStaff(world.admin).execute({
      bookingId: mine?.id ?? '',
      start: iso(at('2027-01-06', '15:00')),
    });

    expect(result.isErr()).toBe(true);
  });

  it('records an appointment as done only once it has begun', async () => {
    const world = createWorld({ actor: as('editor') });
    await book(world);
    const id = world.bookings.all()[0]?.id ?? '';
    const complete = new CompleteBooking(world.admin);

    expect((await complete.execute({ bookingId: id }))._unsafeUnwrapErr().code).toBe(
      CODES.bookingNotStarted,
    );

    world.clock.set(new Date(at('2027-01-05', '10:05')));
    expect((await complete.execute({ bookingId: id }))._unsafeUnwrap().status).toBe('completed');
    // Done is final.
    expect((await complete.execute({ bookingId: id })).isErr()).toBe(true);
  });

  it('records a no-show once the appointment has begun', async () => {
    const world = createWorld({ actor: as('editor') });
    await book(world);
    const id = world.bookings.all()[0]?.id ?? '';
    world.clock.set(new Date(at('2027-01-05', '10:05')));

    expect(
      (await new MarkBookingNoShow(world.admin).execute({ bookingId: id }))._unsafeUnwrap().status,
    ).toBe('no_show');
  });

  it('tidies up holds that ran out and says how many', async () => {
    const world = createWorld({ actor: as('editor') });
    await hold(world);
    world.clock.advanceMinutes(15);
    const result = (
      await new ReleaseExpiredHolds(world.admin).execute({ websiteId: WEBSITE })
    )._unsafeUnwrap();

    expect(result.released).toBe(1);
    expect(world.bookings.all()[0]?.status).toBe('expired');
    expect(world.audit.types()).toContain('booking.holds_expired');
  });
});

describe('an employee and their calendar', () => {
  const MINE = makeResource('emp-mine', { assignedActorId: 'actor-employee' });
  const COLLEAGUES = makeResource('emp-other', { assignedActorId: 'someone-else' });
  const RANGE = { websiteId: WEBSITE, from: '2027-01-04', to: '2027-01-08' };

  function worldWithTwoCalendars(role: Role) {
    const world = createWorld({ actor: as(role), resources: [MINE, COLLEAGUES] });
    world.bookings.seed(makeBooking({ start: at('2027-01-05', '10:00'), resources: ['emp-mine'] }));
    world.bookings.seed(
      makeBooking({ start: at('2027-01-05', '11:00'), resources: ['emp-other'] }),
    );
    return world;
  }

  it('sees only the bookings on the resources assigned to them', async () => {
    const world = worldWithTwoCalendars('employee');

    const view = (await new GetOperationsCalendar(world.admin).execute(RANGE))._unsafeUnwrap();

    expect(view.bookings).toHaveLength(1);
    expect(view.resources.map((resource) => resource.id)).toEqual(['emp-mine']);
  });

  it.each(['admin', 'editor', 'viewer'] as const)(
    'leaves the whole calendar to a %s',
    async (role) => {
      const world = worldWithTwoCalendars(role);

      const view = (await new GetOperationsCalendar(world.admin).execute(RANGE))._unsafeUnwrap();

      expect(view.bookings).toHaveLength(2);
    },
  );

  it("cannot see an employee resource that is nobody's as their own", async () => {
    const world = createWorld({ actor: as('employee'), resources: [makeResource('emp-free')] });
    world.bookings.seed(makeBooking({ start: at('2027-01-05', '10:00'), resources: ['emp-free'] }));

    const view = (await new GetOperationsCalendar(world.admin).execute(RANGE))._unsafeUnwrap();

    expect(view.bookings).toEqual([]);
  });

  it('may not configure resources or manage bookings', async () => {
    const world = createWorld({ actor: as('employee') });

    const resource = await new CreateBookableResource(world.admin).execute({
      websiteId: WEBSITE,
      locationId: null,
      name: 'Desk',
      type: 'employee',
      skills: [],
      capacity: null,
      availability: null,
      isActive: true,
    });
    const cancelled = await new CancelBookingAsStaff(world.admin).execute({ bookingId: 'x' });

    expect(resource._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(cancelled._unsafeUnwrapErr().kind).toBe('forbidden');
  });

  it('is assigned by an editor, but only to an employee resource', async () => {
    const world = createWorld({ actor: as('editor') });
    const base = {
      websiteId: WEBSITE,
      locationId: null,
      name: 'Room 1',
      skills: [],
      capacity: null,
      availability: null,
      isActive: true,
    } as const;

    const person = await new CreateBookableResource(world.admin).execute({
      ...base,
      type: 'employee',
      assignedActorId: 'actor-employee',
      employeeMayEditHours: true,
    });
    const room = await new CreateBookableResource(world.admin).execute({
      ...base,
      type: 'room',
      assignedActorId: 'actor-employee',
    });
    const ownerless = await new CreateBookableResource(world.admin).execute({
      ...base,
      type: 'employee',
      employeeMayEditHours: true,
    });

    expect(person._unsafeUnwrap()).toMatchObject({
      assignedActorId: 'actor-employee',
      employeeMayEditHours: true,
    });
    expect(room.isErr()).toBe(true);
    expect(ownerless.isErr()).toBe(true);
  });
});

describe('an employee changing their own hours', () => {
  const WEEKDAY_HOURS = { intervals: [{ start: '09:00', end: '12:00' }], breaks: [] };
  const HOURS = {
    weekly: [
      WEEKDAY_HOURS,
      WEEKDAY_HOURS,
      WEEKDAY_HOURS,
      WEEKDAY_HOURS,
      WEEKDAY_HOURS,
      { intervals: [], breaks: [] },
      { intervals: [], breaks: [] },
    ],
    exceptions: [],
  };
  const mine = (overrides: Parameters<typeof makeResource>[1] = {}) =>
    makeResource('emp-mine', {
      assignedActorId: 'actor-employee',
      employeeMayEditHours: true,
      ...overrides,
    });

  it('changes only the hours of a calendar assigned to them and allowed by an editor', async () => {
    const world = createWorld({ actor: as('employee'), resources: [mine()] });

    const updated = await new UpdateOwnAvailability(world.admin).execute({
      resourceId: 'emp-mine',
      availability: HOURS,
    });

    expect(updated._unsafeUnwrap().availability?.weekly[0]?.intervals).toEqual([
      { start: '09:00', end: '12:00' },
    ]);
    expect(updated._unsafeUnwrap()).toMatchObject({
      name: 'emp-mine',
      assignedActorId: 'actor-employee',
      employeeMayEditHours: true,
    });
  });

  it.each([
    ['not allowed by an editor', mine({ employeeMayEditHours: false })],
    ['assigned to someone else', mine({ assignedActorId: 'someone-else' })],
    ['assigned to nobody', mine({ assignedActorId: null, employeeMayEditHours: false })],
  ])('finds nothing to change on a calendar that is %s', async (_name, resource) => {
    const world = createWorld({ actor: as('employee'), resources: [resource] });

    const result = await new UpdateOwnAvailability(world.admin).execute({
      resourceId: 'emp-mine',
      availability: HOURS,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('is refused to roles without the permission, even for a calendar assigned to their id', async () => {
    const world = createWorld({
      actor: as('viewer'),
      resources: [mine({ assignedActorId: 'actor-viewer' })],
    });

    const result = await new UpdateOwnAvailability(world.admin).execute({
      resourceId: 'emp-mine',
      availability: HOURS,
    });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });

  it('lists to an employee only the resources assigned to them', async () => {
    const world = createWorld({
      actor: as('employee'),
      resources: [mine(), makeResource('emp-other', { assignedActorId: 'someone-else' })],
    });

    const own = (await new GetOwnResources(world.admin).execute(WEBSITE))._unsafeUnwrap();
    const access = (await new GetBookingAccess(world.admin).execute())._unsafeUnwrap();

    expect(own.map((resource) => resource.id)).toEqual(['emp-mine']);
    expect(access).toEqual({ canConfigure: false, canManage: false, isOwnOnly: true });
  });
});
