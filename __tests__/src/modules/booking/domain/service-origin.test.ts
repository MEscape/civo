import { describe, expect, it } from 'vitest';

import type { BookableService } from '@modules/booking/domain/models/bookable-service';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import { serviceAtLocation, settingAt } from '@modules/booking/domain/models/service-at-location';
import { isSharedElsewhere, originAt } from '@modules/booking/domain/models/service-origin';

const WEST = toBookingLocationId('west');
const EAST = toBookingLocationId('east');

describe('how a service came to be at a location', () => {
  it('is its own where it was made, a copy where it says it was taken from, linked elsewhere', () => {
    expect(originAt({ homeLocationId: WEST, copiedFromLocationId: null }, WEST)).toEqual({
      kind: 'own',
    });
    expect(originAt({ homeLocationId: EAST, copiedFromLocationId: WEST }, EAST)).toEqual({
      kind: 'copy',
      fromLocationId: WEST,
    });
    expect(originAt({ homeLocationId: WEST, copiedFromLocationId: null }, EAST)).toEqual({
      kind: 'linked',
      homeLocationId: WEST,
    });
  });

  it('is its own when no home is known', () => {
    expect(originAt({ homeLocationId: null, copiedFromLocationId: null }, EAST).kind).toBe('own');
  });

  it('is shared elsewhere only with more than one location', () => {
    expect(isSharedElsewhere({ locations: [] })).toBe(false);
    expect(isSharedElsewhere({ locations: [{}, {}] as never })).toBe(true);
  });
});

describe('a service as one location books it', () => {
  const link = (resourceId: string, isRequired: boolean) => ({
    resourceId,
    resourceType: 'room',
    isRequired,
  });
  const service = {
    requirements: [{ resourceType: 'employee', skills: ['x'], count: 1, resourceIds: [] }],
    locations: [
      {
        locationId: WEST,
        isActive: true,
        isOnlineBookable: true,
        resources: [link('r1', true), link('r2', false)],
      },
    ],
  } as unknown as BookableService;

  it('adds the required resources of that location after the shared requirement, and no optional one', () => {
    const booked = serviceAtLocation(service, WEST);

    expect(booked.requirements.map((requirement) => requirement.resourceIds)).toEqual([[], ['r1']]);
  });

  it('leaves a location that does not offer it unchanged', () => {
    expect(settingAt(service, EAST)).toBeNull();
    expect(serviceAtLocation(service, EAST)).toBe(service);
  });
});
