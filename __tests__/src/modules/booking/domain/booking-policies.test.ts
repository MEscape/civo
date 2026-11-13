import { describe, expect, it } from 'vitest';

import {
  MAX_CUSTOMER_RESCHEDULES,
  evaluateCancellation,
  evaluateRescheduling,
} from '@modules/booking/domain/policies/change-policy';
import {
  evaluateBookable,
  mayLeaveEmployeesUnassigned,
  missingInformation,
} from '@modules/booking/domain/policies/service-policy';
import { addMinutes } from '@modules/booking/domain/time/instant';

import {
  LOCATION,
  MONDAY,
  NOW,
  OTHER_LOCATION,
  allowedPolicy,
  makeBooking,
  makeService,
  minutes,
} from '../support/booking-fixtures';
import { at } from '../support/time-fixtures';

describe('cancellation and rescheduling policy', () => {
  const booking = makeBooking();
  const service = makeService({
    cancellation: allowedPolicy(60),
    rescheduling: allowedPolicy(120),
  });

  it('puts the customer deadline at the minute: the start minus the deadline is still in time', () => {
    const inTime = at(MONDAY, '09:00');
    expect(evaluateCancellation(service, booking, { actor: 'customer', now: inTime })).toBeNull();
    expect(
      evaluateCancellation(service, booking, {
        actor: 'customer',
        now: addMinutes(inTime, minutes(1)),
      }),
    ).toBe('deadline-passed');
    expect(
      evaluateRescheduling(service, booking, { actor: 'customer', now: at(MONDAY, '08:00') }),
    ).toBeNull();
    expect(
      evaluateRescheduling(service, booking, { actor: 'customer', now: at(MONDAY, '08:01') }),
    ).toBe('deadline-passed');
  });

  it('does not bind employees and managers to the deadline, even after the start', () => {
    const afterStart = at(MONDAY, '11:00');
    for (const actor of ['employee', 'manager'] as const) {
      expect(evaluateCancellation(service, booking, { actor, now: afterStart })).toBeNull();
      expect(evaluateRescheduling(service, booking, { actor, now: afterStart })).toBeNull();
    }
  });

  it('tells apart a service that forbids it from an actor it does not name', () => {
    const off = makeService({ cancellation: allowedPolicy(60, { isAllowed: false }) });
    const managersOnly = makeService({
      cancellation: allowedPolicy(60, { allowedActors: ['manager'] }),
    });

    expect(evaluateCancellation(off, booking, { actor: 'manager', now: NOW })).toBe('disabled');
    expect(evaluateCancellation(managersOnly, booking, { actor: 'customer', now: NOW })).toBe(
      'actor-not-allowed',
    );
    expect(evaluateCancellation(managersOnly, booking, { actor: 'manager', now: NOW })).toBeNull();
  });

  it('limits how often a customer may move a booking, and nobody else', () => {
    const attempt = (count: number, actor: 'customer' | 'employee') =>
      evaluateRescheduling(service, makeBooking({ rescheduleCount: count }), { actor, now: NOW });

    expect(attempt(MAX_CUSTOMER_RESCHEDULES - 1, 'customer')).toBeNull();
    expect(attempt(MAX_CUSTOMER_RESCHEDULES, 'customer')).toBe('limit-reached');
    expect(attempt(MAX_CUSTOMER_RESCHEDULES + 5, 'employee')).toBeNull();
  });

  it('reads the deadline from the booking it is asked about: a later booking has a later deadline', () => {
    const later = makeBooking({ start: at(MONDAY, '15:00'), end: at(MONDAY, '15:30') });
    expect(
      evaluateCancellation(service, later, { actor: 'customer', now: at(MONDAY, '13:30') }),
    ).toBeNull();
    expect(
      evaluateCancellation(service, booking, { actor: 'customer', now: at(MONDAY, '13:30') }),
    ).toBe('deadline-passed');
  });

  it('lets anybody abandon a hold', () => {
    const hold = makeBooking({
      status: 'held',
      customer: null,
      holdExpiresAt: addMinutes(NOW, minutes(5)),
    });
    const off = makeService({
      cancellation: allowedPolicy(60, { isAllowed: false, allowedActors: [] }),
    });
    expect(
      evaluateCancellation(off, hold, { actor: 'customer', now: at(MONDAY, '10:30') }),
    ).toBeNull();
  });
});

describe('service policy', () => {
  it('books only a service that is on, at the locations that offer it', () => {
    const book = (service: Parameters<typeof evaluateBookable>[0], location = LOCATION) =>
      evaluateBookable(service, location, 'online');
    expect(book(makeService())).toBeNull();
    expect(book(makeService({ isActive: false }))).toBe('service-inactive');
    expect(book(makeService(), OTHER_LOCATION)).toBe('location-not-offered');
    // A switched-off service is reported before the location.
    expect(book(makeService({ isActive: false }), OTHER_LOCATION)).toBe('service-inactive');
    expect(book(makeService({ locations: [] }))).toBe('location-not-offered');
    // A location that has it switched off does not offer it either.
    expect(
      book(
        makeService({
          locations: [
            { locationId: LOCATION, isActive: false, isOnlineBookable: true, resources: [] },
          ],
        }),
      ),
    ).toBe('service-inactive');
  });

  it('keeps a service that takes no online bookings for a manager to book', () => {
    const service = makeService({
      locations: [{ locationId: LOCATION, isActive: true, isOnlineBookable: false, resources: [] }],
    });
    expect(evaluateBookable(service, LOCATION, 'online')).toBe('location-not-offered');
    expect(evaluateBookable(service, LOCATION, 'staff')).toBeNull();
  });

  it('lists the required details that are missing or blank, in the order the service asks', () => {
    const service = makeService();
    expect(missingInformation(service, {})).toEqual(['firstName', 'email']);
    expect(missingInformation(service, { firstName: 'Julia' })).toEqual(['email']);
    expect(missingInformation(service, { firstName: '   ', email: '' })).toEqual([
      'firstName',
      'email',
    ]);
    expect(missingInformation(service, { firstName: 'Julia', email: 'j@x.de' })).toEqual([]);
    // Optional fields never count, and fields the service did not ask for are ignored.
    expect(missingInformation(makeService({ information: [] }), {})).toEqual([]);
  });

  it('allows a booking without its employee only for a service assigned later', () => {
    expect(mayLeaveEmployeesUnassigned(makeService({ assignmentMode: 'automatic' }))).toBe(false);
    expect(mayLeaveEmployeesUnassigned(makeService({ assignmentMode: 'manual' }))).toBe(true);
    expect(mayLeaveEmployeesUnassigned(makeService({ assignmentMode: 'open' }))).toBe(true);
  });
});
