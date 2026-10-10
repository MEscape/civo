import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { persistenceFailed } from '../../domain/errors/booking-errors';
import { createBookingLocationDraft } from '../../domain/models/booking-location';
import { toBookingLocationId, toWebsiteId } from '../../domain/models/ids';
import { readStoredLocation } from '../../domain/models/stored-shapes';

import type { BookingLocation } from '../../domain/models/booking-location';

export interface LocationRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly openingHours: unknown;
  readonly isActive: boolean;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/** Field list for `.select(...)`; `satisfies` keeps it in sync with the record. */
export const LOCATION_SELECT = [
  'id',
  'tenantId',
  'websiteId',
  'name',
  'address',
  'timeZone',
  'openingHours',
  'isActive',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof LocationRecord>;

/**
 * Restores a location through the same constructor that validated it on the
 * way in, so a row that no longer satisfies the rules (an unknown time zone,
 * overlapping hours) is reported instead of reaching the scheduling engine.
 */
export function toLocation(
  record: LocationRecord,
): AppResult<BookingLocation, InfrastructureAppError> {
  const stored = readStoredLocation(record);
  if (stored === null) {
    return err(persistenceFailed(new Error('A stored location has JSON of an unexpected shape.')));
  }
  const draft = createBookingLocationDraft({
    websiteId: toWebsiteId(record.websiteId),
    name: record.name,
    address: record.address,
    timeZone: record.timeZone,
    openingHours: stored.openingHours,
    isActive: record.isActive,
  });
  if (draft.isErr()) {
    return err(persistenceFailed(draft.error));
  }
  return ok({
    ...draft.value,
    id: toBookingLocationId(record.id),
    tenantId: toTenantId(record.tenantId),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  });
}
