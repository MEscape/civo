import { describe, expect, it } from 'vitest';

import type { Role } from '@modules/auth/domain/models/role';
import { CreateBookableService } from '@modules/booking/application/commands/create-bookable-service';
import { UpdateBookableService } from '@modules/booking/application/commands/update-bookable-service';
import type { CreateBookableServiceInput } from '@modules/booking/application/contracts/booking-inputs';
import { GetBookingOptions } from '@modules/booking/application/queries/get-booking-options';
import { PreviewServiceFeasibility } from '@modules/booking/application/queries/preview-service-feasibility';
import { BOOKING_VALIDATION_CODES } from '@modules/booking/domain/errors/booking-errors';

import { OTHER_TENANT, actorWithRole } from '../support/fakes';
import { LOCATION_ID, TENANT, WEBSITE, makeResource, makeService } from '../support/fixtures';
import { createWorld } from '../support/world';

const ROOM = { resourceType: 'room', skills: [], count: 1, resourceIds: null };

const serviceInput = (
  overrides: Partial<CreateBookableServiceInput> = {},
): CreateBookableServiceInput => ({
  websiteId: WEBSITE,
  name: 'Room hire',
  description: null,
  category: null,
  isActive: true,
  durationMinutes: 60,
  preparationMinutes: 0,
  cleanupMinutes: 0,
  slotIntervalMinutes: 60,
  locationIds: [LOCATION_ID],
  requirements: [ROOM],
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

describe('publishing a service that nothing can serve', () => {
  it('refuses to switch on a service whose resources do not exist, naming the field', async () => {
    const world = createWorld({ actor: as('admin') });
    const result = await new CreateBookableService(world.admin).execute(serviceInput());

    const error = result._unsafeUnwrapErr();
    expect(error.kind === 'validation' && error.fieldErrors).toEqual({
      isActive: [BOOKING_VALIDATION_CODES.serviceNotBookable],
    });
  });

  it('saves the same service as a draft, which may name resources not made yet', async () => {
    const world = createWorld({ actor: as('admin') });
    const result = await new CreateBookableService(world.admin).execute(
      serviceInput({ isActive: false }),
    );

    expect(result._unsafeUnwrap().isActive).toBe(false);
  });

  it('refuses to switch a draft on until the resource exists, then allows it', async () => {
    const world = createWorld({ actor: as('admin'), resources: [makeResource('emp-1')] });
    const draft = (
      await new CreateBookableService(world.admin).execute(serviceInput({ isActive: false }))
    )._unsafeUnwrap();
    const update = new UpdateBookableService(world.admin);

    const refused = await update.execute({ ...serviceInput(), id: draft.id });
    world.resources.seed(makeResource('room-1', { type: 'room' }));
    const allowed = await update.execute({ ...serviceInput(), id: draft.id });

    expect(refused.isErr()).toBe(true);
    expect(allowed._unsafeUnwrap().isActive).toBe(true);
  });

  it('lets a service that needs employees go live before any of them offers it', async () => {
    const world = createWorld({ actor: as('admin'), resources: [] });
    const result = await new CreateBookableService(world.admin).execute(
      serviceInput({
        requirements: [{ resourceType: 'employee', skills: [], count: 1, resourceIds: null }],
      }),
    );

    expect(result.isOk()).toBe(true);
  });

  it('does not count a resource that belongs to another tenant', async () => {
    const world = createWorld({ actor: as('admin'), resources: [] });
    world.resources.seed(makeResource('foreign-room', { type: 'room', tenantId: OTHER_TENANT }));
    const result = await new PreviewServiceFeasibility(world.admin).execute({
      websiteId: WEBSITE,
      locationIds: [LOCATION_ID],
      requirements: [ROOM],
      participantsPerBooking: 1,
      participantsPerSession: 1,
    });

    expect(result._unsafeUnwrap().canBePublished).toBe(false);
  });
});

describe('previewing whether a service can work', () => {
  const query = {
    websiteId: WEBSITE,
    locationIds: [LOCATION_ID],
    requirements: [ROOM],
    participantsPerBooking: 1,
    participantsPerSession: 1,
  };

  it('says which requirement fails and how far the candidates narrowed down', async () => {
    const world = createWorld({ actor: as('admin') });
    const view = (await new PreviewServiceFeasibility(world.admin).execute(query))._unsafeUnwrap();

    expect(view.canBePublished).toBe(false);
    expect(view.locations[0]).toMatchObject({
      locationName: 'Town hall',
      readiness: 'blocked',
      block: 'not-enough-resources',
      blockedRequirementIndex: 0,
    });
    expect(view.locations[0]?.coverage[0]?.funnel).toEqual({
      ofType: 0,
      withSkills: 0,
      atLocation: 0,
      inPool: 0,
    });
  });

  it('turns ready as soon as a matching resource exists', async () => {
    const world = createWorld({ actor: as('admin') });
    world.resources.seed(makeResource('room-1', { type: 'room' }));
    const view = (await new PreviewServiceFeasibility(world.admin).execute(query))._unsafeUnwrap();

    expect(view.canBePublished).toBe(true);
    expect(view.locations[0]?.readiness).toBe('ready');
    expect(view.locations[0]?.coverage[0]?.eligible.map((entry) => entry.name)).toEqual(['room-1']);
  });

  it('is for those who configure; a viewer who may only read is refused', async () => {
    const world = createWorld({ actor: as('viewer') });
    const result = await new PreviewServiceFeasibility(world.admin).execute(query);

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('refuses a question that names no location or no requirement', async () => {
    const world = createWorld({ actor: as('admin') });
    const result = await new PreviewServiceFeasibility(world.admin).execute({
      ...query,
      locationIds: [],
      requirements: [],
    });

    const error = result._unsafeUnwrapErr();
    expect(error.kind === 'validation' && Object.keys(error.fieldErrors).sort()).toEqual([
      'locationIds',
      'requirements',
    ]);
  });
});

describe('what the forms choose from', () => {
  it('offers the capabilities resources have, without the services employees offer, and the categories in use', async () => {
    const world = createWorld({
      actor: as('viewer'),
      resources: [
        makeResource('emp-1', { skills: ['sign-language'] }),
        makeResource('room-1', { type: 'room', skills: ['projector', 'wheelchair'] }),
      ],
      service: makeService({ category: 'citizen-services' }),
    });
    const options = (await new GetBookingOptions(world.admin).execute(WEBSITE))._unsafeUnwrap();

    expect(options.skills).toEqual(['projector', 'sign-language', 'wheelchair']);
    expect(options.categories).toEqual(['citizen-services']);
    expect(options.resources.find((resource) => resource.name === 'emp-1')?.skills).toEqual([
      'sign-language',
    ]);
  });
});
