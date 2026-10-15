import { describe, expect, it } from 'vitest';

import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import { assessServiceFeasibility } from '@modules/booking/domain/scheduling/service-feasibility';
import type { FeasibilityService } from '@modules/booking/domain/scheduling/service-feasibility';

import { LOCATION_ID, makeLocation, makeResource, makeService } from '../support/fixtures';

const ANNEX_ID = toBookingLocationId('location-2');

function serviceOf(overrides: Parameters<typeof makeService>[0] = {}): FeasibilityService {
  const { id, requirements, capacity, locationIds } = makeService(overrides);
  return { id, requirements, capacity, locationIds };
}

const ROOM = { resourceType: 'room', skills: [], count: 1, resourceIds: null } as const;

describe('service feasibility', () => {
  it('is ready when each requirement has a resource', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({ requirements: [ROOM] }),
      locations: [makeLocation()],
      resources: [makeResource('room-1', { type: 'room' })],
    });

    expect(result.canBePublished).toBe(true);
    expect(result.locations[0]).toMatchObject({ readiness: 'ready', block: null });
    expect(result.locations[0]?.coverage[0]?.eligible.map((entry) => entry.name)).toEqual([
      'room-1',
    ]);
  });

  it('is blocked, naming the requirement, when nothing of the type exists', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({ requirements: [ROOM] }),
      locations: [makeLocation()],
      resources: [makeResource('emp-1')],
    });

    expect(result.canBePublished).toBe(false);
    expect(result.locations[0]).toMatchObject({
      readiness: 'blocked',
      block: 'not-enough-resources',
      blockedRequirementIndex: 0,
    });
    expect(result.locations[0]?.coverage[0]?.funnel).toEqual({
      ofType: 0,
      withSkills: 0,
      atLocation: 0,
      inPool: 0,
    });
  });

  it('shows where the candidates dropped out: type, skills, location, pool', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({
        requirements: [
          { resourceType: 'room', skills: ['projector'], count: 1, resourceIds: null },
        ],
      }),
      locations: [makeLocation()],
      resources: [
        makeResource('plain-room', { type: 'room' }),
        makeResource('annex-room', { type: 'room', skills: ['projector'], locationId: ANNEX_ID }),
      ],
    });

    expect(result.locations[0]?.coverage[0]?.funnel).toEqual({
      ofType: 2,
      withSkills: 1,
      atLocation: 0,
      inPool: 0,
    });
  });

  it('counts a resource without a location at every location', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({ locationIds: [LOCATION_ID, ANNEX_ID], requirements: [ROOM] }),
      locations: [makeLocation(), makeLocation({ id: ANNEX_ID, name: 'Annex' })],
      resources: [makeResource('mobile-room', { type: 'room', locationId: null })],
    });

    expect(result.locations.map((entry) => entry.readiness)).toEqual(['ready', 'ready']);
  });

  it('blocks only the locations that lack the resource, but can still be published', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({ locationIds: [LOCATION_ID, ANNEX_ID], requirements: [ROOM] }),
      locations: [makeLocation(), makeLocation({ id: ANNEX_ID, name: 'Annex' })],
      resources: [makeResource('room-1', { type: 'room', locationId: LOCATION_ID })],
    });

    expect(result.locations.map((entry) => entry.readiness)).toEqual(['ready', 'blocked']);
    expect(result.canBePublished).toBe(true);
  });

  it('needs as many resources as the requirement counts', () => {
    const service = serviceOf({ requirements: [{ ...ROOM, count: 2 }] });
    const one = assessServiceFeasibility({
      service,
      locations: [makeLocation()],
      resources: [makeResource('room-1', { type: 'room' })],
    });
    const two = assessServiceFeasibility({
      service,
      locations: [makeLocation()],
      resources: [
        makeResource('room-1', { type: 'room' }),
        makeResource('room-2', { type: 'room' }),
      ],
    });

    expect(one.locations[0]?.readiness).toBe('blocked');
    expect(two.locations[0]?.readiness).toBe('ready');
  });

  it('notices requirements that compete for the one resource they both fit', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({
        requirements: [ROOM, { ...ROOM, skills: ['projector'] }],
      }),
      locations: [makeLocation()],
      resources: [makeResource('only', { type: 'room', skills: ['projector'] })],
    });

    expect(result.locations[0]).toMatchObject({
      readiness: 'blocked',
      block: 'shared-resources',
      blockedRequirementIndex: null,
    });
  });

  it('waits for employees instead of blocking: they choose which services they offer', () => {
    const service = serviceOf();
    const employee = makeResource('emp-1');
    const result = assessServiceFeasibility({
      service,
      locations: [makeLocation()],
      resources: [{ ...employee, skills: [] }],
    });

    expect(result.locations[0]?.readiness).toBe('awaiting-employees');
    expect(result.locations[0]?.coverage[0]).toMatchObject({
      eligibleCount: 0,
      awaitingEmployees: 1,
    });
    expect(result.canBePublished).toBe(true);
  });

  it('does not count inactive resources', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({ requirements: [ROOM] }),
      locations: [makeLocation()],
      resources: [makeResource('room-1', { type: 'room', isActive: false })],
    });

    expect(result.locations[0]?.readiness).toBe('blocked');
  });

  it('reports the largest group the resources can host', () => {
    const result = assessServiceFeasibility({
      service: serviceOf({
        capacity: { participantsPerBooking: 20, participantsPerSession: 20 },
        requirements: [ROOM],
      }),
      locations: [makeLocation()],
      resources: [
        makeResource('small', { type: 'room', capacity: 6 }),
        makeResource('hall', { type: 'room', capacity: 12 }),
      ],
    });

    expect(result.locations[0]?.largestGroup).toBe(12);
  });

  it('answers for a draft that has no id yet, holding employees back', () => {
    const { requirements, capacity, locationIds } = makeService();
    const result = assessServiceFeasibility({
      service: { id: null, requirements, capacity, locationIds },
      locations: [makeLocation()],
      resources: [makeResource('emp-1')],
    });

    expect(result.locations[0]?.readiness).toBe('awaiting-employees');
  });

  it('ignores locations the service is not offered at', () => {
    const result = assessServiceFeasibility({
      service: serviceOf(),
      locations: [makeLocation(), makeLocation({ id: ANNEX_ID })],
      resources: [makeResource('emp-1')],
    });

    expect(result.locations).toHaveLength(1);
  });
});
