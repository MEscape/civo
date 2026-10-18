import { describe, expect, it } from 'vitest';

import { ResolveBookingNames } from '@modules/booking/application/queries/resolve-booking-names';

import { actorWithRole } from '../support/fakes';
import { LOCATION_ID, SERVICE_ID, TENANT, at, makeBooking } from '../support/fixtures';
import { createWorld } from '../support/world';

const none = { serviceIds: [], locationIds: [], resourceIds: [], bookingIds: [] };

describe('naming bookings by id for the audit log', () => {
  it('names services, locations and resources, and a booking by its reference only', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });
    world.bookings.seed(
      makeBooking({
        id: 'b-1',
        start: at('2027-01-04', '09:00'),
        resources: ['emp-1'],
        reference: 'K7Q2M9X4TZ',
      }),
    );

    const names = await new ResolveBookingNames(world.admin).execute('website-1', {
      serviceIds: [SERVICE_ID],
      locationIds: [LOCATION_ID],
      resourceIds: ['emp-1'],
      bookingIds: ['b-1'],
    });

    expect(names._unsafeUnwrap()).toEqual({
      services: [{ id: SERVICE_ID, name: 'Passport application' }],
      locations: [{ id: LOCATION_ID, name: expect.any(String) }],
      resources: [{ id: 'emp-1', name: expect.any(String) }],
      bookings: [{ id: 'b-1', name: 'K7Q2M9X4TZ' }],
    });
  });

  it('names nothing of another website, and drops ids that cannot be ids', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'admin') });

    const names = await new ResolveBookingNames(world.admin).execute('website-1', {
      ...none,
      serviceIds: ['foreign-service', 'deleted-service', ''],
    });

    expect(names._unsafeUnwrap().services).toEqual([]);
  });

  it('is refused to someone who may only read their own bookings', async () => {
    const world = createWorld({ actor: actorWithRole(TENANT, 'employee') });

    const names = await new ResolveBookingNames(world.admin).execute('website-1', {
      ...none,
      serviceIds: [SERVICE_ID],
    });

    expect(names._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});
