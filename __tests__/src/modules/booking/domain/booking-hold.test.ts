import { describe, expect, it } from 'vitest';

import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES,
} from '@modules/booking/domain/errors/booking-errors';
import {
  confirmBooking,
  createHold,
  expireHold,
} from '@modules/booking/domain/lifecycle/booking-hold';
import { findInvariantViolations } from '@modules/booking/domain/lifecycle/booking-invariants';
import { isBlocking } from '@modules/booking/domain/models/booking';
import { addMinutes } from '@modules/booking/domain/time/instant';

import {
  BOOKING_ID,
  LOCATION,
  NOW,
  OTHER_LOCATION,
  makeBooking,
  makeService,
  minutes,
  slotAt,
  unitOf,
} from '../support/booking-fixtures';
import { unwrap } from '../support/time-fixtures';

const HOLD = minutes(10);
const CUSTOMER = { firstName: 'Julia', email: 'julia@example.org' };

function codeOf(result: { isErr(): boolean; error?: { code: string } }): string | undefined {
  return result.isErr() ? result.error?.code : undefined;
}

describe('making a hold', () => {
  const service = makeService();
  const slot = slotAt(service, '10:00');

  it('reserves the slot for the hold time and pins the employee of an automatic service', () => {
    const hold = unwrap(
      createHold({
        id: BOOKING_ID,
        service,
        locationId: LOCATION,
        channel: 'online',
        slot,
        now: NOW,
        holdMinutes: HOLD,
      }),
    );

    expect(hold.status).toBe('held');
    expect(hold.customer).toBeNull();
    expect(hold.holdExpiresAt).toBe(addMinutes(NOW, HOLD));
    expect(hold.assignments).toEqual([unitOf('anna')]);
    expect([hold.start, hold.end]).toEqual([slot.start, slot.end]);
    expect(hold.occupied).toEqual(slot.occupied);
    expect(hold.createdAt).toBe(NOW);
    expect(findInvariantViolations(hold)).toEqual([]);
  });

  it('leaves the employee open for a service that is assigned later, and holds the room', () => {
    const manual = makeService({
      assignmentMode: 'manual',
      requirements: [
        { resourceType: 'employee', skills: [], count: 1, resourceIds: null },
        { resourceType: 'room', skills: [], count: 1, resourceIds: null },
      ],
    });
    const hold = unwrap(
      createHold({
        id: BOOKING_ID,
        service: manual,
        locationId: LOCATION,
        channel: 'online',
        slot: slotAt(manual, '10:00', [['anna'], ['room-1']]),
        now: NOW,
        holdMinutes: HOLD,
      }),
    );

    expect(hold.assignments).toEqual([
      unitOf(null),
      unitOf('room-1', { requirementIndex: 1, resourceType: 'room' }),
    ]);
    expect(findInvariantViolations(hold)).toEqual([]);
  });

  it('refuses a service that is switched off, or not offered at the location', () => {
    const input = {
      id: BOOKING_ID,
      slot,
      channel: 'online' as const,
      now: NOW,
      holdMinutes: HOLD,
    };
    expect(
      codeOf(
        createHold({ ...input, service: makeService({ isActive: false }), locationId: LOCATION }),
      ),
    ).toBe(CODES.serviceInactive);
    expect(codeOf(createHold({ ...input, service, locationId: OTHER_LOCATION }))).toBe(
      CODES.locationNotOffered,
    );
  });

  it('refuses a slot the service could not have produced', () => {
    const input = {
      id: BOOKING_ID,
      service,
      locationId: LOCATION,
      channel: 'online' as const,
      now: NOW,
      holdMinutes: HOLD,
    };
    const tooLong = { ...slot, end: addMinutes(slot.end, minutes(5)) };
    const noResources = { ...slot, requirementResourceIds: [] };
    // An employee is held for exactly the service's preparation and clean-up.
    const wrongBuffers = {
      ...slot,
      resourceSpans: {
        anna: { ...slot.occupied, end: addMinutes(slot.occupied.end, minutes(5)) },
      },
    };
    const wrongCount = slotAt(service, '10:00', [['anna', 'ben']]);

    for (const bad of [tooLong, noResources, wrongBuffers, wrongCount]) {
      expect(codeOf(createHold({ ...input, slot: bad }))).toBe(CODES.slotUnavailable);
    }
  });
});

describe('confirming a hold', () => {
  const service = makeService();
  const hold = makeBooking({
    status: 'held',
    customer: null,
    holdExpiresAt: addMinutes(NOW, minutes(10)),
  });

  it('confirms with the visitor details, and ends the hold', () => {
    const confirmed = unwrap(
      confirmBooking({ booking: hold, service, customer: CUSTOMER, now: NOW }),
    );

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.customer).toEqual(CUSTOMER);
    expect(confirmed.holdExpiresAt).toBeNull();
    expect(confirmed.updatedAt).toBe(NOW);
    expect(findInvariantViolations(confirmed)).toEqual([]);
  });

  it('is refused for a hold that ran out, exactly at the expiry instant', () => {
    const justBefore = addMinutes(NOW, minutes(9));
    const atExpiry = addMinutes(NOW, minutes(10));

    expect(
      confirmBooking({ booking: hold, service, customer: CUSTOMER, now: justBefore }).isOk(),
    ).toBe(true);
    const refused = confirmBooking({ booking: hold, service, customer: CUSTOMER, now: atExpiry });
    expect(refused.isErr() && refused.error.code).toBe(CODES.bookingExpired);
  });

  it('reports every blank required field, and accepts blank optional ones', () => {
    const refused = confirmBooking({ booking: hold, service, customer: { phone: '' }, now: NOW });
    expect(refused.isErr() && 'fieldErrors' in refused.error && refused.error.fieldErrors).toEqual({
      'customer.firstName': [BOOKING_VALIDATION_CODES.fieldRequired],
      'customer.email': [BOOKING_VALIDATION_CODES.fieldRequired],
    });
    expect(
      confirmBooking({
        booking: hold,
        service,
        customer: { firstName: '  ', email: 'a@b.de' },
        now: NOW,
      }).isErr(),
    ).toBe(true);
  });

  it('is refused while an employee is still to be assigned, for an automatic service', () => {
    const open = { ...hold, assignments: [unitOf(null)] };
    expect(codeOf(confirmBooking({ booking: open, service, customer: CUSTOMER, now: NOW }))).toBe(
      CODES.assignmentIncomplete,
    );
    const manual = makeService({ assignmentMode: 'open' });
    expect(
      confirmBooking({ booking: open, service: manual, customer: CUSTOMER, now: NOW }).isOk(),
    ).toBe(true);
  });

  it('is refused for a booking that is not a hold', () => {
    for (const status of ['confirmed', 'cancelled', 'completed', 'no_show', 'expired'] as const) {
      expect(
        codeOf(
          confirmBooking({
            booking: makeBooking({ status }),
            service,
            customer: CUSTOMER,
            now: NOW,
          }),
        ),
      ).toBe(CODES.invalidStateTransition);
    }
  });
});

describe('letting a hold expire', () => {
  const hold = makeBooking({
    status: 'held',
    customer: null,
    holdExpiresAt: addMinutes(NOW, minutes(10)),
  });

  it('marks a hold that ran out, and refuses one that is still running', () => {
    expect(codeOf(expireHold(hold, addMinutes(NOW, minutes(9))))).toBe(CODES.holdNotExpired);
    const expired = unwrap(expireHold(hold, addMinutes(NOW, minutes(10))));
    expect(expired.status).toBe('expired');
    expect(expired.holdExpiresAt).toBeNull();
    expect(isBlocking(expired, NOW)).toBe(false);
    expect(findInvariantViolations(expired)).toEqual([]);
  });

  it('refuses anything that is not a hold', () => {
    expect(codeOf(expireHold(makeBooking(), NOW))).toBe(CODES.invalidStateTransition);
  });
});
