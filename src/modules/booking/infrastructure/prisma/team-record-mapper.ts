import { toActorId } from '@modules/auth';

import { toJsonValue } from '@lib/db';
import type { InstantRecord } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';

import { writeAvailability } from './availability-record-mapper';
import { RESOURCE_SELECT, toResource } from './bookable-resource-record-mapper';
import { writeCoverage } from './coverage-record-mapper';
import { readInstant } from './instant-record-mapper';

import type { ResourceRecord } from './bookable-resource-record-mapper';
import type { NewEmployee, StoredEmployee } from '../../domain/ports/team.repository';

export interface EmployeeRecord extends ResourceRecord {
  readonly assignedActorId: string | null;
  readonly updatedAt: InstantRecord;
}

export const EMPLOYEE_SELECT = [
  ...RESOURCE_SELECT,
  'assignedActorId',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof EmployeeRecord>;

/** A person's calendar as the team reads it; a row that is not one (no member, no location) is refused. */
export function toStoredEmployee(
  record: EmployeeRecord,
): AppResult<StoredEmployee, InfrastructureAppError> {
  const updatedAt = readInstant(record.updatedAt);
  return toResource(record).andThen((resource) => {
    const { locationId } = resource;
    if (
      resource.type !== 'employee' ||
      locationId === null ||
      record.assignedActorId === null ||
      updatedAt === null
    ) {
      return err(bookingDataInvalid('employee'));
    }
    return ok({
      id: resource.id,
      actorId: toActorId(record.assignedActorId),
      name: resource.name,
      locationId,
      skills: resource.skills,
      isActive: resource.isActive,
      availability: resource.availability,
      coverage: resource.coverage,
      updatedAt,
    });
  });
}

const toNullableJson = (value: unknown) => (value === null ? null : toJsonValue(value));

/** The columns a change may set: never the member, the kind or the location. */
export function toEmployeeChangeColumns(employee: NewEmployee) {
  return {
    name: employee.name,
    skills: toJsonValue([...employee.skills]),
    isActive: employee.isActive,
    availability:
      employee.availability === null ? null : toJsonValue(writeAvailability(employee.availability)),
    coverage: toNullableJson(writeCoverage(employee.coverage)),
  };
}

export function toNewEmployeeColumns(employee: NewEmployee) {
  return {
    ...toEmployeeChangeColumns(employee),
    type: 'employee' as const,
    locationId: employee.locationId,
    assignedActorId: employee.actorId,
  };
}
