import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString, literalGuard } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';
import { RESOURCE_TYPES } from '../../domain/models/bookable-resource';
import { toBookableResourceId, toBookingLocationId } from '../../domain/models/ids';
import { parseMinutes } from '../../domain/time/minutes';

import { readOptionalAvailability } from './availability-record-mapper';
import { readCoverage } from './coverage-record-mapper';

import type { BookableResource } from '../../domain/models/bookable-resource';

export interface ResourceRecord {
  readonly id: string;
  readonly name: string;
  readonly capacity: number | null;
  readonly locationId: string | null;
  readonly type: string;
  readonly skills: unknown;
  readonly isActive: boolean;
  readonly setupMinutes: number;
  readonly teardownMinutes: number;
  readonly availability: unknown;
  readonly coverage: unknown;
}

export const RESOURCE_SELECT = [
  'id',
  'name',
  'capacity',
  'locationId',
  'type',
  'skills',
  'isActive',
  'setupMinutes',
  'teardownMinutes',
  'availability',
  'coverage',
] as const satisfies ReadonlyArray<keyof ResourceRecord>;

const isResourceKind = literalGuard(RESOURCE_TYPES);
const isStringList = arrayOf(isString);

export function toResource(
  record: ResourceRecord,
): AppResult<BookableResource, InfrastructureAppError> {
  const setupMinutes = parseMinutes(record.setupMinutes);
  const teardownMinutes = parseMinutes(record.teardownMinutes);
  if (
    !isResourceKind(record.type) ||
    !isStringList(record.skills) ||
    setupMinutes === null ||
    teardownMinutes === null
  ) {
    return err(bookingDataInvalid('resource'));
  }
  const availability = readOptionalAvailability(record.availability);
  if (availability.isErr()) {
    return err(availability.error);
  }
  const coverage = readCoverage(record.coverage);
  if (coverage.isErr()) {
    return err(coverage.error);
  }
  return ok({
    id: toBookableResourceId(record.id),
    name: record.name,
    capacity: record.capacity,
    type: record.type,
    skills: record.skills,
    locationId: record.locationId === null ? null : toBookingLocationId(record.locationId),
    isActive: record.isActive,
    setupMinutes,
    teardownMinutes,
    availability: availability.value,
    coverage: coverage.value,
  });
}
