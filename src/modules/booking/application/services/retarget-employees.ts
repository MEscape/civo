import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';
import { draftOfResource, withManagerChange } from '../../domain/models/bookable-resource';
import { employeeHoursOf } from '../../domain/models/booking-location';
import { clipToFrame } from '../../domain/scheduling/hours-containment';
import { MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { AvailabilityPlan } from '../../domain/models/availability-plan';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { BookingDependencies } from '../booking-dependencies';

const samePlan = (a: AvailabilityPlan, b: AvailabilityPlan): boolean =>
  JSON.stringify(toAvailabilityPlanInput(a)) === JSON.stringify(toAvailabilityPlanInput(b));

/** The week an employee has after the location's hours changed, or `null` when it stays as it is. */
function retargetedWeek(
  employee: BookableResource,
  location: BookingLocation,
): AvailabilityPlan | null {
  const frame = employeeHoursOf(location);
  const own = employee.availability ?? location.openingHours;
  if (employee.availability === null && location.staffHours === null) {
    return null;
  }
  const clipped = clipToFrame(own, frame);
  return samePlan(own, clipped) ? null : clipped;
}

/**
 * After a location's hours are saved, the weeks of the employees who work there
 * are brought inside what employees may now work: a week that reaches beyond is
 * cut to fit, and one that followed the opening hours becomes the narrower
 * hours employees may work. Each employee they change is told, on their own
 * calendar, that a manager did it and when: nobody's week is changed behind
 * their back. Weeks that already fit are not touched.
 */
export function retargetEmployees(
  deps: Pick<BookingDependencies, 'resources' | 'clock'>,
  { tenantId, location }: { readonly tenantId: TenantId; readonly location: BookingLocation },
): AppResultAsync<undefined, InfrastructureAppError | NotFoundAppError> {
  return deps.resources
    .listByWebsite(location.websiteId, tenantId, MAX_RESOURCES_PER_WEBSITE)
    .andThen((stored) =>
      stored
        .filter((resource) => resource.type === 'employee' && resource.locationId === location.id)
        .reduce<AppResultAsync<undefined, InfrastructureAppError | NotFoundAppError>>(
          (previous, employee) =>
            previous.andThen(() => {
              const week = retargetedWeek(employee, location);
              if (week === null) {
                return okAsync(undefined);
              }
              return deps.resources
                .update(employee.id, tenantId, {
                  ...draftOfResource(employee),
                  availability: week,
                  managerChange: withManagerChange(employee.managerChange, {
                    kind: 'hours',
                    at: deps.clock.now(),
                  }),
                })
                .map(() => undefined);
            }),
          okAsync(undefined),
        ),
    );
}
