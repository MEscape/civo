import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import {
  cancellationsFor,
  parseResolutions,
} from '@modules/booking/application/services/closing-resolutions';
import { toBookableServiceId, toBookingId } from '@modules/booking/domain/models/ids';
import type { StoredService } from '@modules/booking/domain/models/stored-service';
import type { StoredBooking } from '@modules/booking/domain/ports/booking.repository';

import { NOW, allowedPolicy, makeBooking, makeService } from '../support/booking-fixtures';

describe('closing-resolutions application service', () => {
  const service: StoredService = {
    ...makeService({
      id: toBookableServiceId('svc-1'),
      name: 'Service 1',
      cancellation: allowedPolicy(24 * 60),
      rescheduling: allowedPolicy(12 * 60),
    }),
    description: null,
    category: null,
    requiredDocuments: [],
    instructions: null,
    internalNote: null,
    participantsPerBooking: 1,
    participantsPerSession: 1,
    homeLocationId: null,
    copiedFromLocationId: null,
    locations: [],
    updatedAt: NOW,
  };

  const booking1 = makeBooking({ id: toBookingId('b-1') });
  const booking2 = makeBooking({ id: toBookingId('b-2') });

  const stored1: StoredBooking = {
    tenantId: toTenantId('tenant-1'),
    booking: booking1,
    placement: {
      reference: 'REF-1',
      participants: 1,
      sessionKey: 'sk-1',
      sessionCapacity: 1,
      snapshot: null,
    },
  };
  const stored2: StoredBooking = {
    tenantId: toTenantId('tenant-1'),
    booking: booking2,
    placement: {
      reference: 'REF-2',
      participants: 1,
      sessionKey: 'sk-2',
      sessionCapacity: 1,
      snapshot: null,
    },
  };

  describe('parseResolutions', () => {
    it('parses valid resolution inputs', () => {
      const result = parseResolutions([
        { bookingId: 'b-1', kind: 'cancel' },
        { bookingId: 'b-2', kind: 'leave' },
      ]);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.get(toBookingId('b-1'))).toBe('cancel');
        expect(result.value.get(toBookingId('b-2'))).toBe('leave');
      }
    });

    it('rejects invalid booking id or invalid resolution kind', () => {
      const badId = parseResolutions([{ bookingId: '', kind: 'cancel' }]);
      expect(badId.isErr()).toBe(true);

      const badKind = parseResolutions([{ bookingId: 'b-1', kind: 'delete' }]);
      expect(badKind.isErr()).toBe(true);
    });
  });

  describe('cancellationsFor', () => {
    it('produces cancellation changes for decided cancel bookings', () => {
      const decided = new Map([
        [toBookingId('b-1'), 'cancel' as const],
        [toBookingId('b-2'), 'leave' as const],
      ]);

      const result = cancellationsFor({
        service,
        bookings: [stored1, stored2],
        isTruncated: false,
        decided,
        now: NOW,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.changes).toHaveLength(1);
        expect(result.value.changes[0]?.stored.booking.id).toBe('b-1');
        expect(result.value.changes[0]?.stored.booking.status).toBe('cancelled');
        expect(result.value.leftOpen).toBe(1); // booking 2 was left open
      }
    });

    it('rejects when bookings list is truncated or has undecided bookings', () => {
      const decided = new Map([[toBookingId('b-1'), 'cancel' as const]]);

      const truncated = cancellationsFor({
        service,
        bookings: [stored1],
        isTruncated: true,
        decided,
        now: NOW,
      });
      expect(truncated.isErr()).toBe(true);

      const undecided = cancellationsFor({
        service,
        bookings: [stored1, stored2], // b-2 missing from decided
        isTruncated: false,
        decided,
        now: NOW,
      });
      expect(undecided.isErr()).toBe(true);
    });
  });
});
