import { describe, expect, it } from 'vitest';

import { CreateBookableResource } from '@modules/booking/application/commands/create-bookable-resource';
import { CreateBookableService } from '@modules/booking/application/commands/create-bookable-service';
import { OfferServiceAtLocation } from '@modules/booking/application/commands/offer-service-at-location';
import { SaveOwnProfile } from '@modules/booking/application/commands/save-own-profile';
import { SetTeamHours } from '@modules/booking/application/commands/set-team-hours';
import { UpdateBookingLocation } from '@modules/booking/application/commands/update-booking-location';
import { BOOKING_VALIDATION_CODES } from '@modules/booking/domain/errors/booking-errors';
import { toAvailabilityPlanInput } from '@modules/booking/domain/models/availability-plan';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import { weekdaysOutside } from '@modules/booking/domain/scheduling/hours-containment';

import { actorWithRole } from '../support/fakes';
import {
  LOCATION_ID,
  SERVICE_ID,
  TENANT,
  WEBSITE,
  hours,
  makeLocation,
  makeResource,
  makeService,
  plan,
  weekdays,
} from '../support/fixtures';
import { createWorld } from '../support/world';

// The location is open Monday to Friday, 08:00 to 18:00.
const INSIDE = toAvailabilityPlanInput(weekdays('09:00', '17:00'));
const SATURDAY = toAvailabilityPlanInput(plan({ 6: hours('09:00', '12:00') }));
const TOO_EARLY = toAvailabilityPlanInput(plan({ 2: hours('07:00', '12:00') }));

const ROOM_INPUT = {
  websiteId: WEBSITE,
  locationId: LOCATION_ID as string,
  name: 'Meeting room',
  type: 'room',
  skills: [],
  capacity: 8,
  isActive: true,
  assignedActorId: null,
};

describe('the weekdays a plan reaches outside another', () => {
  const frame = plan({ 1: hours('08:00', '12:00'), 2: hours('08:00', '12:00') });

  it('names the days with a stretch the frame does not cover', () => {
    const own = plan({
      1: hours('09:00', '11:00'),
      2: hours('11:00', '13:00'),
      3: hours('09:00', '10:00'),
    });

    expect(weekdaysOutside(own, frame)).toEqual([2, 3]);
  });

  it('counts a stretch spanning two touching openings as covered', () => {
    const split = plan({
      1: {
        intervals: [
          { start: '08:00', end: '12:00' },
          { start: '12:00', end: '16:00' },
        ],
        breaks: [],
      },
    });

    expect(weekdaysOutside(plan({ 1: hours('10:00', '15:00') }), split)).toEqual([]);
  });

  it('has nothing to say about a plan that is never open', () => {
    expect(weekdaysOutside(plan({}), frame)).toEqual([]);
  });
});

describe('hours of a resource inside its location', () => {
  it('refuses a day the location is closed, naming the day', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });

    const error = (
      await new CreateBookableResource(world.admin).execute({
        ...ROOM_INPUT,
        availability: SATURDAY,
      })
    )._unsafeUnwrapErr();

    expect(error.kind === 'validation' && error.fieldErrors).toEqual({
      'availability.weekly.5.intervals': [BOOKING_VALIDATION_CODES.hoursOutsideLocation],
    });
  });

  it('accepts hours inside, and a resource that follows the location', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });
    const create = new CreateBookableResource(world.admin);

    expect((await create.execute({ ...ROOM_INPUT, availability: INSIDE })).isOk()).toBe(true);
    expect((await create.execute({ ...ROOM_INPUT, availability: null })).isOk()).toBe(true);
  });

  it('does not compare hours of a resource that travels with any one location', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });

    const result = await new CreateBookableResource(world.admin).execute({
      ...ROOM_INPUT,
      locationId: null,
      availability: SATURDAY,
    });

    expect(result.isOk()).toBe(true);
  });
});

describe('hours of an employee inside their location', () => {
  const profile = (availability: typeof INSIDE | null) => ({
    websiteId: WEBSITE,
    name: 'Anna',
    locationId: LOCATION_ID as string,
    offeredServiceIds: [SERVICE_ID as string],
    availability,
  });

  it('are checked when the employee sets them', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'employee'), resources: [] });
    const save = new SaveOwnProfile(world.admin);

    const refused = await save.execute(profile(TOO_EARLY));
    const accepted = await save.execute(profile(INSIDE));

    expect(refused._unsafeUnwrapErr().kind).toBe('validation');
    expect(accepted.isOk()).toBe(true);
  });

  it('are checked when a manager sets them, and nobody is changed when one fails', async () => {
    const world = createWorld({
      actor: actorWithRole(TENANT, 'admin'),
      resources: [
        makeResource('emp-1', { locationId: LOCATION_ID }),
        makeResource('emp-2', { locationId: LOCATION_ID }),
      ],
    });

    const refused = await new SetTeamHours(world.admin).execute({
      resourceIds: ['emp-1', 'emp-2'],
      availability: TOO_EARLY,
    });

    expect(refused.isErr()).toBe(true);
    expect(
      (await world.resources.listByWebsite(WEBSITE, TENANT, 10))
        ._unsafeUnwrap()
        .every((r) => r.availability === null),
    ).toBe(true);
  });
});

describe('hours of a service inside the locations that offer it', () => {
  const serviceInput = (
    availability: typeof INSIDE | null,
    locationIds = [LOCATION_ID as string],
  ) => ({
    websiteId: WEBSITE,
    name: 'Passports',
    description: null,
    category: null,
    isActive: false,
    durationMinutes: 30,
    preparationMinutes: 0,
    cleanupMinutes: 0,
    slotIntervalMinutes: 30,
    locationIds,
    requirements: [{ resourceType: 'employee', skills: [], count: 1, resourceIds: null }],
    participantsPerBooking: 1,
    participantsPerSession: 1,
    noticeMinutes: 0,
    horizonDays: 30,
    availability,
    cancellation: { isAllowed: true, deadlineMinutes: 60, allowedActors: ['customer', 'staff'] },
    rescheduling: { isAllowed: true, deadlineMinutes: 60, allowedActors: ['customer', 'staff'] },
    information: [{ field: 'email', isRequired: true }],
    requiredDocuments: [],
    instructions: null,
  });

  it('are refused where they reach beyond the opening hours', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });

    const error = (
      await new CreateBookableService(world.admin).execute(serviceInput(TOO_EARLY))
    )._unsafeUnwrapErr();

    expect(error.kind === 'validation' && error.fieldErrors).toEqual({
      'availability.weekly.1.intervals': [BOOKING_VALIDATION_CODES.hoursOutsideLocation],
    });
  });

  it('must fit a location they are added to as well as the ones they already have', async () => {
    const annex = toBookingLocationId('location-2');
    const world = createWorld({
      actor: actorWithRole(TENANT, 'admin'),
      service: makeService({ availability: weekdays('09:00', '17:00') }),
    });
    world.locations.seed(
      makeLocation({ id: annex, name: 'Annex', openingHours: weekdays('10:00', '16:00') }),
    );

    const refused = await new OfferServiceAtLocation(world.admin).execute({
      serviceId: SERVICE_ID,
      locationId: annex,
      isOffered: true,
    });

    expect(refused._unsafeUnwrapErr().kind).toBe('validation');
  });
});

describe('new opening hours of a location', () => {
  const update = (openingHours: typeof INSIDE) => ({
    id: LOCATION_ID as string,
    websiteId: WEBSITE,
    name: 'Town hall',
    address: null,
    timeZone: 'Europe/Berlin',
    openingHours,
    isActive: true,
  });

  it('may not close while a service, a room or an employee there is still open', async () => {
    const world = createWorld({
      actor: actorWithRole(TENANT, 'admin'),
      service: makeService({ availability: weekdays('09:00', '17:00') }),
      resources: [
        makeResource('room-1', {
          type: 'room',
          locationId: LOCATION_ID,
          availability: plan({ 1: hours('08:00', '09:00') }),
        }),
      ],
    });

    const error = (
      await new UpdateBookingLocation(world.admin).execute(
        update(toAvailabilityPlanInput(weekdays('10:00', '16:00'))),
      )
    )._unsafeUnwrapErr();

    // The room (Monday, 08:00) and the service (every weekday from 09:00) reach out of 10:00-16:00.
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors ?? {})).toEqual([
      'openingHours.weekly.0.intervals',
      'openingHours.weekly.1.intervals',
      'openingHours.weekly.2.intervals',
      'openingHours.weekly.3.intervals',
      'openingHours.weekly.4.intervals',
    ]);
  });

  it('may be widened, or narrowed around what is there', async () => {
    const world = createWorld({
      actor: actorWithRole(TENANT, 'admin'),
      service: makeService({ availability: weekdays('09:00', '17:00') }),
    });
    const save = new UpdateBookingLocation(world.admin);

    expect(
      (await save.execute(update(toAvailabilityPlanInput(weekdays('07:00', '19:00'))))).isOk(),
    ).toBe(true);
    expect(
      (await save.execute(update(toAvailabilityPlanInput(weekdays('09:00', '17:00'))))).isOk(),
    ).toBe(true);
  });

  it('is not held up by hours of something at another location', async () => {
    const world = createWorld({
      actor: actorWithRole(TENANT, 'admin'),
      resources: [
        makeResource('room-elsewhere', {
          type: 'room',
          locationId: null,
          availability: plan({ 6: hours('09:00', '12:00') }),
        }),
      ],
    });

    const result = await new UpdateBookingLocation(world.admin).execute(update(INSIDE));

    expect(result.isOk()).toBe(true);
  });
});
