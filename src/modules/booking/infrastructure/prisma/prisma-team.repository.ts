import { randomUUID } from 'node:crypto';

import type { ActorId } from '@modules/auth';
import { toActorId } from '@modules/auth';

import { advisoryLock, createPersistenceFailures, db } from '@lib/db';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { combine, errAsync, fromThrowableAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import { isDefined } from '@lib/utils';

import {
  BOOKING_ERROR_CODES as CODES,
  employeeAlreadySetUp,
  resourceNotFound,
  resourceStale,
} from '../../domain/errors/booking-errors';
import { isSentTo } from '../../domain/models/employee-coverage';
import { toBookableResourceId } from '../../domain/models/ids';
import { asInstant, laterOf } from '../../domain/time/instant';
import { writeCalendarNotice } from '../transactions/calendar-notice';

import { toRecordInstant, versionWindow } from './instant-record-mapper';
import {
  EMPLOYEE_SELECT,
  toEmployeeChangeColumns,
  toNewEmployeeColumns,
  toStoredEmployee,
} from './team-record-mapper';
import { resourcesOf } from './tenant-ownership';

import type { BookableResourceId, BookingLocationId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  EmployeeChange,
  EmployeeSetUp,
  EmployeeWriteError,
  StoredEmployee,
  TeamRepository,
} from '../../domain/ports/team.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Employee calendar',
});

/**
 * The people's calendars of a website: employee resources that name their member, and are in a team.
 * A member taken out of a team keeps the calendar (calendars are never deleted: its bookings and history
 * belong to it) but it is switched off, so it is nowhere in the team and the member can be set up again.
 */
const calendarsOf = (scope: BookingScope, source?: Parameters<typeof resourcesOf>[1]) =>
  resourcesOf(scope, source)
    .where({ type: 'employee', isActive: true })
    .where((resource) => resource.assignedActorId.isNotNull());

function readOne(
  record: Parameters<typeof toStoredEmployee>[0] | null,
): AppResult<StoredEmployee | null, InfrastructureAppError> {
  return record === null ? ok(null) : toStoredEmployee(record);
}

/**
 * The team's access to employees' calendars, bound to the tenant and the website in every statement.
 * Setting a member up takes a lock on the member first, so two managers doing it at once make one
 * calendar, not two; a change is one `UPDATE … WHERE id AND updatedAt`.
 */
export class PrismaTeamRepository implements TeamRepository {
  listAt(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly members: readonly StoredEmployee[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      async () =>
        calendarsOf(scope)
          .where({ locationId })
          .select(...EMPLOYEE_SELECT)
          .orderBy([(resource) => resource.name.asc(), (resource) => resource.id.asc()])
          .limit(limit + 1)
          .all(),
      failures.infraOnly('listTeam'),
    ).andThen((records) =>
      combine(records.slice(0, limit).map(toStoredEmployee)).asyncMap((members) =>
        Promise.resolve({ members, isTruncated: records.length > limit }),
      ),
    );
  }

  listVisiting(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly members: readonly StoredEmployee[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      async () =>
        calendarsOf(scope)
          .where((resource) => resource.coverage.isNotNull())
          .select(...EMPLOYEE_SELECT)
          .orderBy([(resource) => resource.name.asc(), (resource) => resource.id.asc()])
          .limit(limit + 1)
          .all(),
      failures.infraOnly('listVisiting'),
    ).andThen((records) =>
      combine(records.slice(0, limit).map(toStoredEmployee)).map((members) => ({
        members: members.filter((member) => isSentTo(member, locationId)),
        isTruncated: records.length > limit,
      })),
    );
  }

  listActorIds(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<
    { readonly actorIds: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(async () => {
      const rows = await calendarsOf(scope)
        .select('assignedActorId')
        .orderBy((resource) => resource.id.asc())
        .limit(limit + 1)
        .all();
      return {
        actorIds: rows
          .slice(0, limit)
          .map((row) => row.assignedActorId)
          .filter(isDefined)
          .map(toActorId),
        isTruncated: rows.length > limit,
      };
    }, failures.infraOnly('listTeamMembers'));
  }

  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<StoredEmployee | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        calendarsOf(scope)
          .where({ id })
          .select(...EMPLOYEE_SELECT)
          .first(),
      failures.infraOnly('findEmployee'),
    ).andThen(readOne);
  }

  findOfActor(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<StoredEmployee | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        calendarsOf(scope)
          .where({ assignedActorId: actorId })
          .select(...EMPLOYEE_SELECT)
          // Rows written before the lock existed may name a member twice: the same one every time.
          .orderBy((resource) => resource.id.asc())
          .first(),
      failures.infraOnly('findEmployeeOfActor'),
    ).andThen(readOne);
  }

  create(
    scope: BookingScope,
    setUp: EmployeeSetUp,
    now: Instant,
  ): AppResultAsync<StoredEmployee, ConflictAppError | InfrastructureAppError> {
    const { notice = [], ...employee } = setUp;
    const id = randomUUID();
    const stamp = toRecordInstant(now);
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          await advisoryLock(tx, `booking-team:${scope.websiteId}:${employee.actorId}`);
          const existing = await calendarsOf(scope, tx)
            .where({ assignedActorId: employee.actorId })
            .select('id')
            .first();
          if (existing !== null) {
            return false;
          }
          await tx.orm.public.BookableResource.select('id').create({
            id,
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            ...toNewEmployeeColumns(employee),
            createdAt: stamp,
            updatedAt: stamp,
          });
          await writeCalendarNotice(
            { tx, scope, now },
            {
              resourceId: toBookableResourceId(id),
              locationId: employee.locationId,
              parts: notice,
            },
          );
          return true;
        }),
      failures.infraOnly('createEmployee'),
    ).andThen((isCreated) =>
      isCreated
        ? okAsync({ ...employee, id: toBookableResourceId(id), updatedAt: now })
        : errAsync(employeeAlreadySetUp()),
    );
  }

  save(
    scope: BookingScope,
    { stored, expected, now, notice = [] }: EmployeeChange,
  ): AppResultAsync<StoredEmployee, EmployeeWriteError> {
    // The stamp is the version the next writer must name, so it moves even when this clock does not.
    const stamp = laterOf(now, asInstant(expected + 1));
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const swapped = await calendarsOf(scope, tx)
            .where({ id: stored.id })
            .where((resource) => resource.updatedAt.gte(versionWindow(expected).from))
            .where((resource) => resource.updatedAt.lt(versionWindow(expected).until))
            .updateAndCount({
              ...toEmployeeChangeColumns(stored),
              updatedAt: toRecordInstant(stamp),
            });
          if (swapped > 0) {
            await writeCalendarNotice(
              { tx, scope, now },
              {
                resourceId: stored.id,
                locationId: stored.locationId,
                parts: notice,
              },
            );
          }
          return swapped;
        }),
      failures.infraOnly('saveEmployee'),
    ).andThen((swapped): AppResultAsync<StoredEmployee, EmployeeWriteError> => {
      if (swapped > 0) {
        return okAsync({ ...stored, updatedAt: stamp });
      }
      return this.findById(scope, stored.id).andThen((current) =>
        errAsync(current === null ? resourceNotFound() : resourceStale()),
      );
    });
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaTeamRepository = new PrismaTeamRepository();
