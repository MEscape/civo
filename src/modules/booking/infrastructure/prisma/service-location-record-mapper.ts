import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isBoolean, isString, objectOf, unique } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { toBookableResourceId, toBookingLocationId } from '../../domain/models/ids';

import { readInstant } from './instant-record-mapper';

import type { ResourceKind } from '../../domain/models/bookable-resource';
import type { ServiceLocationSetting } from '../../domain/models/service-location';
import type { StoredServiceLocation } from '../../domain/models/stored-service';

/** A switched-on service at one location, as the table stores it. */
export interface ServiceLocationRecord {
  readonly locationId: string;
  readonly isActive: boolean;
  readonly isOnlineBookable: boolean;
  readonly resources: unknown;
}

export const SERVICE_LOCATION_SELECT = [
  'locationId',
  'isActive',
  'isOnlineBookable',
  'resources',
] as const satisfies ReadonlyArray<keyof ServiceLocationRecord>;

interface StoredLink {
  readonly resourceId: string;
  readonly isRequired: boolean;
}

const isLink = objectOf<StoredLink>({ resourceId: isString, isRequired: isBoolean });
const isLinkList = arrayOf(isLink);

/** The links a row stores, or `null` when the JSON is not in the shape the writes make. */
export function readLinks(resources: unknown): readonly StoredLink[] | null {
  return isLinkList(resources) ? resources : null;
}

/** The resource ids a set of rows names, each once: what the resources' types are looked up for. */
export function linkedResourceIds(records: readonly ServiceLocationRecord[]): string[] {
  return unique(
    records.flatMap((record) =>
      isLinkList(record.resources) ? record.resources.map((link) => link.resourceId) : [],
    ),
  );
}

/**
 * The settings of a service. The type of each linked resource is read from the resource itself, so
 * it cannot go stale; a link whose resource is gone (nothing in the database ties the two) is left
 * out and does not hold a slot.
 */
export function readSettings(
  records: readonly ServiceLocationRecord[],
  typeOf: ReadonlyMap<string, ResourceKind>,
): AppResult<ServiceLocationSetting[], InfrastructureAppError> {
  const settings: ServiceLocationSetting[] = [];
  for (const record of records) {
    if (!isLinkList(record.resources)) {
      return err(bookingDataInvalid('service location resources'));
    }
    settings.push({
      locationId: toBookingLocationId(record.locationId),
      isActive: record.isActive,
      isOnlineBookable: record.isOnlineBookable,
      resources: record.resources.flatMap((link) => {
        const resourceType = typeOf.get(link.resourceId);
        return resourceType === undefined
          ? []
          : [
              {
                resourceId: toBookableResourceId(link.resourceId),
                resourceType,
                isRequired: link.isRequired,
              },
            ];
      }),
    });
  }
  return ok(settings);
}

/** A switched-on service as the administration reads it: the rules' part and the version of this location's part. */
export interface StoredServiceLocationRecord extends ServiceLocationRecord {
  readonly updatedAt: InstantRecord;
}

export const STORED_SERVICE_LOCATION_SELECT = [
  ...SERVICE_LOCATION_SELECT,
  'updatedAt',
] as const satisfies ReadonlyArray<keyof StoredServiceLocationRecord>;

/** `readSettings` with the version of each part. */
export function readStoredSettings(
  records: readonly StoredServiceLocationRecord[],
  typeOf: ReadonlyMap<string, ResourceKind>,
): AppResult<StoredServiceLocation[], InfrastructureAppError> {
  return readSettings(records, typeOf).andThen((settings) => {
    const stored: StoredServiceLocation[] = [];
    for (const [index, setting] of settings.entries()) {
      const record = records[index];
      const updatedAt = record === undefined ? null : readInstant(record.updatedAt);
      if (updatedAt === null) {
        return err(bookingDataInvalid('service location version'));
      }
      stored.push({ ...setting, updatedAt });
    }
    return ok(stored);
  });
}
