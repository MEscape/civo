import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTenantId } from '@modules/auth';
import { loadCandidates } from '@modules/booking/application/services/assignment-candidates';
import { decideAssignment } from '@modules/booking/application/services/decide-assignment';
import { assessEligibility } from '@modules/booking/domain/assignment/assignment-eligibility';
import {
  toBookableResourceId,
  toBookingLocationId,
  toWebsiteId,
} from '@modules/booking/domain/models/ids';
import type { BookingLocationFacts } from '@modules/booking/domain/ports/booking-location.repository';
import type { BookingScope } from '@modules/booking/domain/ports/booking.repository';

import { okAsync } from '@lib/result';

import { makeBooking, makeService, unitOf } from '../support/booking-fixtures';
import { BERLIN, at } from '../support/time-fixtures';

vi.mock('@modules/booking/application/services/assignment-candidates', () => ({
  loadCandidates: vi.fn(),
  daysOf: vi.fn(),
}));

vi.mock('@modules/booking/domain/assignment/assignment-eligibility', () => ({
  assessEligibility: vi.fn(),
}));

describe('decideAssignment application service', () => {
  const scope: BookingScope = {
    tenantId: toTenantId('tenant-1'),
    websiteId: toWebsiteId('web-1'),
  };

  const location: BookingLocationFacts = {
    id: toBookingLocationId('loc-1'),
    name: 'Bürgeramt West',
    address: 'Hauptstr. 1',
    zone: BERLIN,
    isActive: true,
    openingHours: { weekly: {} as any, exceptions: [] },
  };

  const resource1 = toBookableResourceId('res-1');
  const resource2 = toBookableResourceId('res-2');
  const now = at('2027-01-10', '12:00');

  const deps = {
    bookings: {} as any,
    resources: {} as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns original booking immediately when resource already holds unit and replaces is undefined', async () => {
    const booking = makeBooking({
      assignments: [unitOf('res-1')],
    });
    const service = makeService();

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: undefined,
      replaces: undefined,
      now,
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(booking);
    expect(loadCandidates).not.toHaveBeenCalled();
  });

  it('returns validation error when replaces id is invalid', async () => {
    const booking = makeBooking({ assignments: [unitOf(null)] });
    const service = makeService();

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: undefined,
      replaces: '', // empty invalid id
      now,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('returns validation error when requirementIndex is out of range', async () => {
    const booking = makeBooking({ assignments: [unitOf(null)] });
    const service = makeService();

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: 99, // out of range
      replaces: undefined,
      now,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('validation');
  });

  it('returns conflict error when booking has no open unit and no requirement is specified', async () => {
    const booking = makeBooking({
      assignments: [unitOf('res-other')],
    });
    const service = makeService();

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: undefined,
      replaces: undefined,
      now,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('conflict');
    expect(result._unsafeUnwrapErr().code).toBe('booking.already_assigned');
  });

  it('returns not found error when resource is not in candidate list', async () => {
    const booking = makeBooking({ assignments: [unitOf(null)] });
    const service = makeService();

    vi.mocked(loadCandidates).mockReturnValue(okAsync([]));

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: 0,
      replaces: undefined,
      now,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('returns conflict error when candidate is ineligible', async () => {
    const booking = makeBooking({ assignments: [unitOf(null)] });
    const service = makeService();

    const fakeCandidate = {
      resource: { id: resource1, name: 'Anna' } as any,
      schedule: {} as any,
    };
    vi.mocked(loadCandidates).mockReturnValue(okAsync([fakeCandidate]));
    vi.mocked(assessEligibility).mockReturnValue({
      kind: 'ineligible',
      reasons: ['absent'],
    } as any);

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: 0,
      replaces: undefined,
      now,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('conflict');
    expect(result._unsafeUnwrapErr().code).toBe('booking.not_eligible');
  });

  it('assigns resource into open slot when eligible', async () => {
    const booking = makeBooking({ assignments: [unitOf(null)] });
    const service = makeService();

    const fakeCandidate = {
      resource: { id: resource1, name: 'Anna' } as any,
      schedule: {} as any,
    };
    vi.mocked(loadCandidates).mockReturnValue(okAsync([fakeCandidate]));
    vi.mocked(assessEligibility).mockReturnValue({
      kind: 'eligible',
      candidate: { ...fakeCandidate, bookingId: booking.id, requirementIndex: 0 } as any,
    });

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource1,
      requirementIndex: 0,
      replaces: undefined,
      now,
    });

    expect(result.isOk()).toBe(true);
    const assigned = result._unsafeUnwrap();
    expect(assigned.assignments[0]?.resourceId).toBe(resource1);
  });

  it('replaces assigned resource when replaces is specified', async () => {
    const booking = makeBooking({ assignments: [unitOf('res-1')] });
    const service = makeService();

    const fakeCandidate = {
      resource: { id: resource2, name: 'Ben' } as any,
      schedule: {} as any,
    };
    vi.mocked(loadCandidates).mockReturnValue(okAsync([fakeCandidate]));
    vi.mocked(assessEligibility).mockReturnValue({
      kind: 'eligible',
      candidate: { ...fakeCandidate, bookingId: booking.id, requirementIndex: 0 } as any,
    });

    const result = await decideAssignment(deps, {
      scope,
      booking,
      service,
      location,
      resourceId: resource2,
      requirementIndex: undefined,
      replaces: 'res-1',
      now,
    });

    expect(result.isOk()).toBe(true);
    const assigned = result._unsafeUnwrap();
    expect(assigned.assignments[0]?.resourceId).toBe(resource2);
  });
});
