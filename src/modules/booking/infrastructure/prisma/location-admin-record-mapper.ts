import { toJsonValue } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err } from '@lib/result';
import type { AppResult } from '@lib/result';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookingLocationId } from '../../domain/models/ids';
import { parseTimeZone } from '../../domain/time/time-zone';

import { readAvailability, writeAvailability } from './availability-record-mapper';
import { readInstant } from './instant-record-mapper';

import type { NewLocation, StoredLocation } from '../../domain/ports/location-admin.repository';

export interface LocationAdminRecord {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly isActive: boolean;
  readonly openingHours: unknown;
  readonly updatedAt: InstantRecord;
}

export const LOCATION_ADMIN_SELECT = [
  'id',
  'name',
  'address',
  'timeZone',
  'isActive',
  'openingHours',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof LocationAdminRecord>;

/** A stored location as the administration reads it; data that is not in the shape the rules expect is a failure. */
export function toStoredLocation(
  record: LocationAdminRecord,
): AppResult<StoredLocation, InfrastructureAppError> {
  const zone = parseTimeZone(record.timeZone);
  const updatedAt = readInstant(record.updatedAt);
  if (zone === null || updatedAt === null) {
    return err(bookingDataInvalid('location'));
  }
  return readAvailability(record.openingHours).map((openingHours) => ({
    id: toBookingLocationId(record.id),
    name: record.name,
    address: record.address,
    zone,
    isActive: record.isActive,
    openingHours,
    updatedAt,
  }));
}

/** The columns a write sets, from what the rules hold; the hours become the stored JSON shape. */
export function toLocationColumns(location: NewLocation) {
  return {
    name: location.name,
    address: location.address,
    timeZone: location.zone,
    isActive: location.isActive,
    openingHours: toJsonValue(writeAvailability(location.openingHours)),
  };
}
