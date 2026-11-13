import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { BookingDependencies } from '@modules/booking/application/booking-dependencies';
import { findBooking } from '@modules/booking/application/services/find-booking';
import { toBookingId, toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingScope, StoredBooking } from '@modules/booking/domain/ports/booking.repository';

import { okAsync } from '@lib/result';

import { LOCATION, makeBooking, makeService } from '../support/booking-fixtures';
import { BERLIN } from '../support/time-fixtures';

const MINE = toTenantId('site-a');
const actor: Actor = { id: toActorId('actor-1'), tenantId: MINE, roles: ['admin'] };

function depsReturning(row: StoredBooking | null, seen: BookingScope[] = []): BookingDependencies {
  const location = { id: LOCATION, zone: BERLIN, openingHours: { weekly: [], exceptions: [] } };
  return {
    bookings: {
      findById: (scope: BookingScope) => {
        seen.push(scope);
        return okAsync(row);
      },
    },
    services: { findById: () => okAsync(makeService()) },
    locations: { findById: () => okAsync(location) },
  } as unknown as BookingDependencies;
}

const stored: StoredBooking = {
  tenantId: MINE,
  booking: makeBooking({ id: toBookingId('b-1') }),
  placement: {
    reference: 'ABCDEFGH23',
    participants: 1,
    sessionKey: 'booking:b-1',
    sessionCapacity: 1,
    snapshot: null,
  },
};

describe('findBooking', () => {
  it('hands back the booking with the scope built from the authorized actor', async () => {
    const found = (await findBooking(depsReturning(stored), actor, 'b-1'))._unsafeUnwrap();

    expect(found.scope).toEqual({ tenantId: MINE, websiteId: toWebsiteId('site-a') });
    expect(found.actor).toBe(actor);
    expect(found.stored.booking.id).toBe('b-1');
  });

  it('looks the booking up in the actor’s scope, never in one the request names', async () => {
    const seen: BookingScope[] = [];

    await findBooking(depsReturning(stored, seen), actor, 'b-1');

    expect(seen).toEqual([{ tenantId: MINE, websiteId: toWebsiteId('site-a') }]);
  });

  it('answers "not found" for a missing row, the same as for another website’s booking', async () => {
    const error = (await findBooking(depsReturning(null), actor, 'b-1'))._unsafeUnwrapErr();

    expect(error.code).toBe('booking.not_found');
  });

  it('refuses an id that is no id', async () => {
    const error = (await findBooking(depsReturning(stored), actor, ''))._unsafeUnwrapErr();

    expect(error.kind).toBe('validation');
  });
});
