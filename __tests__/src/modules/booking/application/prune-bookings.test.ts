import { describe, expect, it } from 'vitest';

import { pruneBookings } from '@modules/booking/application/services/prune-bookings';
import type { BookingRetentionRepository } from '@modules/booking/domain/ports/booking-retention.repository';

import { okAsync } from '@lib/result';

const NOW = new Date('2027-03-01T12:00:00Z');

describe('keeping bookings to their retention', () => {
  it('deletes what ended before the retention began and answers how much went', async () => {
    const cutoffs: number[] = [];
    const retention: BookingRetentionRepository = {
      deleteEndedBefore: (cutoff) => {
        cutoffs.push(cutoff);
        return okAsync({ bookings: 4, messages: 2 });
      },
    };

    const outcome = await pruneBookings({
      retention,
      clock: { now: () => NOW },
      retentionDays: 30,
    });

    expect(outcome._unsafeUnwrap()).toEqual({ bookings: 4, messages: 2 });
    expect(cutoffs).toEqual([new Date('2027-01-30T12:00:00Z').getTime()]);
  });
});
