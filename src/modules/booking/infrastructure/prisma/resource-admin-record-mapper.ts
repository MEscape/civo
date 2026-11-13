import { toJsonValue } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';

import { writeAvailability } from './availability-record-mapper';
import { RESOURCE_SELECT, toResource } from './bookable-resource-record-mapper';
import { readInstant } from './instant-record-mapper';

import type { ResourceRecord } from './bookable-resource-record-mapper';
import type { NewResource, StoredResource } from '../../domain/ports/resource-admin.repository';

export interface ResourceAdminRecord extends ResourceRecord {
  readonly internalNote: string | null;
  readonly updatedAt: InstantRecord;
}

export const RESOURCE_ADMIN_SELECT = [
  ...RESOURCE_SELECT,
  'internalNote',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ResourceAdminRecord>;

/** A stored physical resource as the administration reads it; an employee or a resource with no location is not one. */
export function toStoredResource(
  record: ResourceAdminRecord,
): AppResult<StoredResource, InfrastructureAppError> {
  const updatedAt = readInstant(record.updatedAt);
  return toResource(record).andThen((resource) => {
    const { type, locationId, skills: _skills, ...rest } = resource;
    if (type === 'employee' || locationId === null || updatedAt === null) {
      return err(bookingDataInvalid('resource'));
    }
    return ok({ ...rest, type, locationId, internalNote: record.internalNote, updatedAt });
  });
}

/** The columns a change may set: never the kind or the location, which bookings and services depend on. */
export function toResourceChangeColumns(resource: NewResource) {
  return {
    name: resource.name,
    capacity: resource.capacity,
    isActive: resource.isActive,
    setupMinutes: resource.setupMinutes,
    teardownMinutes: resource.teardownMinutes,
    availability:
      resource.availability === null ? null : toJsonValue(writeAvailability(resource.availability)),
    internalNote: resource.internalNote,
  };
}

/** Every column of a new resource. */
export function toNewResourceColumns(resource: NewResource) {
  return {
    ...toResourceChangeColumns(resource),
    type: resource.type,
    locationId: resource.locationId,
    skills: toJsonValue([]),
  };
}
