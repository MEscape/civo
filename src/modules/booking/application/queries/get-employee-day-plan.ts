import type { ActorId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { planRelease } from '../../domain/assignment/booking-assignment';
import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { completeBooking, markNoShow } from '../../domain/lifecycle/booking-lifecycle';
import { coverageOn } from '../../domain/models/employee-coverage';
import { availabilityOnDate } from '../../domain/scheduling/availability-plan';
import { formatLocalDate, parseLocalDate } from '../../domain/time/local-date';
import { localDateOf } from '../../domain/time/time-zone';
import { MAX_DAY_PLAN_BOOKINGS } from '../booking-limits';
import { toEmployeeBookingView } from '../booking-view-mappers';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { daySpan, nextOf, phaseOf, workdayOf } from '../services/day-plan';
import { homeZoneOf, labelsOf, loadBookingFacts, loadLocations } from '../services/employee-labels';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingScope, StoredBooking } from '../../domain/ports/booking.repository';
import type { Instant } from '../../domain/time/instant';
import type { LocalDate } from '../../domain/time/local-date';
import type { TimeZone } from '../../domain/time/time-zone';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { GetDayPlanInput } from '../contracts/employee-inputs';
import type { DayPlanItemView, DayPlanView } from '../contracts/employee-views';
import type { LocationsById } from '../services/employee-labels';

export type GetEmployeeDayPlanError =
  BookingAccessError | ValidationAppError | InfrastructureAppError;

/**
 * One day of the signed-in employee's own bookings, earliest first, with what each is called and
 * what the citizen brings: the start page and the day plan. The day is read on the clock of the
 * employee's location; "now" and "next" come from the server's clock. Only bookings the employee
 * serves are read (a condition of the statement), and none carries customer data (BD-26).
 */
export class GetEmployeeDayPlan {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: GetDayPlanInput): AppResultAsync<DayPlanView, GetEmployeeDayPlanError> {
    const { access, resources } = this.deps;
    const now = currentInstant(this.deps.clock);

    return access.authorizeWebsite('booking.read.own', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return resources.findEmployeeOf(scope, actor.id).andThen((own) =>
        loadLocations(this.deps, scope).andThen((locations) => {
          const zone = homeZoneOf(own, locations);
          const today = zone === null ? null : localDateOf(now, zone);
          const date = input.date === undefined ? today : parseLocalDate(input.date);
          if (date === null && input.date !== undefined) {
            return errAsync(fieldValidationFailed('date', CODES.dateRangeInvalid));
          }
          if (own === null || zone === null || today === null || date === null) {
            return okAsync(emptyPlan(date, today, zone));
          }
          const plan = hoursPlanOn(own, date, locations);
          return this.day({ scope, actorId: actor.id, own, date, zone, now, locations }).map(
            (items): DayPlanView => ({
              date: formatLocalDate(date),
              today: formatLocalDate(today),
              timeZone: zone,
              items: items.map(({ view }) => view),
              next:
                formatLocalDate(date) === formatLocalDate(today)
                  ? nextOf(
                      items.map(({ stored }) => stored.booking),
                      now,
                    )
                  : null,
              workday: workdayOf(
                plan === undefined ? [] : availabilityOnDate(plan, date, zone),
                zone,
              ),
              hasCalendar: true,
            }),
          );
        }),
      );
    });
  }

  private day(request: {
    readonly scope: BookingScope;
    readonly actorId: ActorId;
    readonly own: BookableResource;
    readonly date: LocalDate;
    readonly zone: TimeZone;
    readonly now: Instant;
    readonly locations: LocationsById;
  }): AppResultAsync<
    ReadonlyArray<{ readonly stored: StoredBooking; readonly view: DayPlanItemView }>,
    InfrastructureAppError
  > {
    const { scope, actorId, own: ownResource, date, zone, now, locations } = request;
    return this.deps.bookings
      .list(scope, {
        span: daySpan(date, zone),
        statuses: ['confirmed', 'completed', 'no_show'],
        assignedActorId: actorId,
        limit: MAX_DAY_PLAN_BOOKINGS,
      })
      .andThen((own) =>
        loadBookingFacts(
          this.deps,
          scope,
          own.map(({ booking }) => booking),
        ).map((facts) =>
          own.flatMap((stored) => {
            const { booking } = stored;
            const location = locations.get(booking.locationId);
            const service = facts.services.get(booking.serviceId);
            if (location === undefined) {
              return [];
            }
            const phase = phaseOf(booking, now);
            return [
              {
                stored,
                view: {
                  booking: toEmployeeBookingView(stored, location.zone, scope.websiteId),
                  labels: labelsOf(booking, facts, locations),
                  phase,
                  requiredDocuments: service?.requiredDocuments ?? [],
                  instructions: service?.instructions ?? null,
                  // The rule `HandBackBooking` applies, so the button and the command cannot differ.
                  mayHandBack:
                    service !== undefined &&
                    planRelease({ booking, service, resourceId: ownResource.id, now }).kind ===
                      'release',
                  // The rules the commands apply, so the buttons and the commands cannot differ.
                  mayRecordOutcome:
                    completeBooking(booking, now).isOk() && markNoShow(booking, now).isOk(),
                },
              },
            ];
          }),
        ),
      );
  }
}

/** Their own week, or the hours of the location they are at that day when they keep its hours. */
function hoursPlanOn(own: BookableResource, date: LocalDate, locations: LocationsById) {
  const placeOn = coverageOn(own.coverage, date)?.locationId ?? own.locationId;
  return own.availability ?? locations.get(placeOn ?? '')?.openingHours;
}

function emptyPlan(
  date: LocalDate | null,
  today: LocalDate | null,
  zone: TimeZone | null,
): DayPlanView {
  return {
    date: date === null ? '' : formatLocalDate(date),
    today: today === null ? '' : formatLocalDate(today),
    timeZone: zone ?? '',
    items: [],
    next: null,
    workday: null,
    hasCalendar: false,
  };
}
