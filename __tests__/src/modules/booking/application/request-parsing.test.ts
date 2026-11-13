import { describe, expect, it } from 'vitest';

import {
  parseDateRange,
  parseSpan,
  parseStart,
} from '@modules/booking/application/services/request-parsing';
import { BOOKING_VALIDATION_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

describe('booking request-parsing application service', () => {
  describe('parseStart', () => {
    it('parses valid ISO string with offset into Instant', () => {
      const result = parseStart('2027-01-14T09:00:00+01:00');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(typeof result.value).toBe('number');
        expect(result.value).toBeGreaterThan(0);
      }
    });

    it('rejects invalid instant string', () => {
      const result = parseStart('invalid-date');
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['start']).toContain(CODES.startInvalid);
      }
    });
  });

  describe('parseDateRange', () => {
    it('parses valid date range within maxDays', () => {
      const result = parseDateRange({ from: '2027-01-10', to: '2027-01-14' }, 7);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          from: { year: 2027, month: 1, day: 10 },
          to: { year: 2027, month: 1, day: 14 },
        });
      }
    });

    it('rejects invalid from or to dates', () => {
      const badFrom = parseDateRange({ from: 'bad', to: '2027-01-14' }, 7);
      expect(badFrom.isErr()).toBe(true);
      if (badFrom.isErr()) {
        expect(badFrom.error.fieldErrors['from']).toContain(CODES.dateRangeInvalid);
      }

      const badTo = parseDateRange({ from: '2027-01-10', to: 'bad' }, 7);
      expect(badTo.isErr()).toBe(true);
      if (badTo.isErr()) {
        expect(badTo.error.fieldErrors['to']).toContain(CODES.dateRangeInvalid);
      }
    });

    it('rejects when to is before from', () => {
      const reversed = parseDateRange({ from: '2027-01-15', to: '2027-01-10' }, 7);
      expect(reversed.isErr()).toBe(true);
      if (reversed.isErr()) {
        expect(reversed.error.fieldErrors['to']).toContain(CODES.dateRangeInvalid);
      }
    });

    it('rejects when range exceeds maxDays', () => {
      const tooLong = parseDateRange({ from: '2027-01-01', to: '2027-01-20' }, 10);
      expect(tooLong.isErr()).toBe(true);
      if (tooLong.isErr()) {
        expect(tooLong.error.fieldErrors['to']).toContain(CODES.dateRangeTooLong);
      }
    });
  });

  describe('parseSpan', () => {
    it('parses valid span within maxDays', () => {
      const result = parseSpan({ from: '2027-01-10T00:00:00Z', to: '2027-01-12T00:00:00Z' }, 7);
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.end).toBeGreaterThan(result.value.start);
      }
    });

    it('rejects invalid from or to instants', () => {
      const bad = parseSpan({ from: 'not-an-instant', to: '2027-01-12T00:00:00Z' }, 7);
      expect(bad.isErr()).toBe(true);

      const badTo = parseSpan({ from: '2027-01-10T00:00:00Z', to: 'not-an-instant' }, 7);
      expect(badTo.isErr()).toBe(true);
    });

    it('rejects when to is before or equal to from', () => {
      const bad = parseSpan({ from: '2027-01-12T00:00:00Z', to: '2027-01-10T00:00:00Z' }, 7);
      expect(bad.isErr()).toBe(true);
      if (bad.isErr()) {
        expect(bad.error.fieldErrors['to']).toContain(CODES.dateRangeInvalid);
      }
    });

    it('rejects when span exceeds maxDays in milliseconds', () => {
      const tooLong = parseSpan({ from: '2027-01-01T00:00:00Z', to: '2027-01-20T00:00:00Z' }, 5);
      expect(tooLong.isErr()).toBe(true);
      if (tooLong.isErr()) {
        expect(tooLong.error.fieldErrors['to']).toContain(CODES.dateRangeTooLong);
      }
    });
  });
});
