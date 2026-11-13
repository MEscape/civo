import type { ActorId } from '@modules/auth';

import type { ConflictAppError, InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { ManagerChangePart } from '../models/employee-calendar';
import type { CoverageSpell } from '../models/employee-coverage';
import type { BookableResourceId, BookingLocationId } from '../models/ids';
import type { AvailabilityPlan } from '../scheduling/availability-plan';
import type { Instant } from '../time/instant';

/**
 * An employee's calendar as the team screens read and write it: whose it is, where they work, when
 * (`availability`: own week and absences; `null`: whenever the location is open), what they are
 * qualified for, and where a manager sends them for some days. `updatedAt` is the version.
 */
export interface StoredEmployee {
  readonly id: BookableResourceId;
  readonly actorId: ActorId;
  /** The name kept with the calendar, for when the member directory cannot name the person. */
  readonly name: string;
  readonly locationId: BookingLocationId;
  readonly skills: readonly string[];
  readonly isActive: boolean;
  readonly availability: AvailabilityPlan | null;
  /** Where the person works at other locations, and on which days (a manager decides). */
  readonly coverage: readonly CoverageSpell[];
  readonly updatedAt: Instant;
}

export type NewEmployee = Omit<StoredEmployee, 'id' | 'updatedAt'>;

/** A calendar being set up, and what to tell the employee about it (a message in the same transaction). */
export interface EmployeeSetUp extends NewEmployee {
  readonly notice?: readonly ManagerChangePart[];
}

/** A change to a calendar: what it becomes, and the version it was read at. Its member and location never change. */
export interface EmployeeChange {
  readonly stored: StoredEmployee;
  readonly expected: Instant;
  readonly now: Instant;
  /** What a manager changed, to tell the employee in a message written in the same transaction. */
  readonly notice?: readonly ManagerChangePart[];
}

export type EmployeeWriteError = ConflictAppError | NotFoundAppError | InfrastructureAppError;

/**
 * The calendars of the members of one website. Every statement is pinned to the scope; another
 * website's calendar is `null`. A member has at most one calendar: `create` refuses a second
 * (`booking.employee_already_set_up`), also when two managers set the same person up at once. A save
 * is one `UPDATE … WHERE` on the version (`booking.resource_stale`). Calendars are never deleted.
 */
export interface TeamRepository {
  /** The calendars at a location, by name then id; at most `limit`, and `isTruncated` says there were more. */
  listAt(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly members: readonly StoredEmployee[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** The calendars of other locations that send their person here on some days; at most `limit`, and `isTruncated` says there were more. */
  listVisiting(
    scope: BookingScope,
    locationId: BookingLocationId,
    limit: number,
  ): AppResultAsync<
    { readonly members: readonly StoredEmployee[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** The members of the website who have a calendar (anywhere); at most `limit`, and `isTruncated` says there were more. */
  listActorIds(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<
    { readonly actorIds: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<StoredEmployee | null, InfrastructureAppError>;

  findOfActor(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<StoredEmployee | null, InfrastructureAppError>;

  create(
    scope: BookingScope,
    employee: EmployeeSetUp,
    now: Instant,
  ): AppResultAsync<StoredEmployee, ConflictAppError | InfrastructureAppError>;

  save(
    scope: BookingScope,
    change: EmployeeChange,
  ): AppResultAsync<StoredEmployee, EmployeeWriteError>;
}
