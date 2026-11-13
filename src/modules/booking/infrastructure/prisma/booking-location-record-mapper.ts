import type { InfrastructureAppError } from '@lib/errors';
import { err } from '@lib/result';
import type { AppResult } from '@lib/result';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookingLocationId } from '../../domain/models/ids';
import { parseTimeZone } from '../../domain/time/time-zone';

import { readAvailability } from './availability-record-mapper';

import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';

export interface LocationRecord {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly isActive: boolean;
  readonly openingHours: unknown;
}

export const LOCATION_SELECT = [
  'id',
  'name',
  'address',
  'timeZone',
  'isActive',
  'openingHours',
] as const satisfies ReadonlyArray<keyof LocationRecord>;

export function toLocation(
  record: LocationRecord,
): AppResult<BookingLocationFacts, InfrastructureAppError> {
  const zone = parseTimeZone(record.timeZone);
  const openingHours = readAvailability(record.openingHours);
  if (zone === null) {
    return err(bookingDataInvalid('time zone'));
  }
  return openingHours.map((hours) => ({
    id: toBookingLocationId(record.id),
    name: record.name,
    address: record.address,
    zone,
    isActive: record.isActive,
    openingHours: hours,
  }));
}
