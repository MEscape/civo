import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  createBookingErrorBag,
} from '../../domain/errors/booking-errors';
import { employeeHoursOf } from '../../domain/models/booking-location';
import { weekdaysOutside } from '../../domain/scheduling/hours-containment';
import { WEEKDAYS } from '../../domain/time/local-date';
import {
  MAX_LOCATIONS_PER_WEBSITE,
  MAX_RESOURCES_PER_WEBSITE,
  MAX_SERVICES_PER_WEBSITE,
} from '../booking-limits';

import type { AvailabilityPlan } from '../../domain/models/availability-plan';
import type { BookableResourceDraft } from '../../domain/models/bookable-resource';
import type { BookableServiceDraft } from '../../domain/models/bookable-service';
import type { BookingLocation, BookingLocationDraft } from '../../domain/models/booking-location';
import type { BookingLocationId, WebsiteId } from '../../domain/models/ids';
import type { BookingDependencies } from '../booking-dependencies';

type FitError = ValidationAppError | InfrastructureAppError;

interface Scope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/** Where a day of a plan is named in a saved form: `<path>.weekly.<n>.intervals`, Monday first. */
function dayPath(path: string, weekday: (typeof WEEKDAYS)[number]): string {
  return `${path}.weekly.${WEEKDAYS.indexOf(weekday)}.intervals`;
}

/**
 * A service, a resource or an employee is only available while the place is
 * open, so hours of their own must stay inside the location's. Each rule is
 * checked here, where a save is decided, and not left to the slot engine,
 * which would quietly show no times: whoever set the hours is told which days
 * reach beyond the opening hours, and the form marks those days.
 */
export function checkResourceFitsLocation(
  deps: Pick<BookingDependencies, 'locations'>,
  { tenantId }: Scope,
  draft: BookableResourceDraft,
): AppResultAsync<BookableResourceDraft, FitError> {
  if (draft.locationId === null) {
    return okAsync(draft);
  }
  return deps.locations.findById(draft.locationId, tenantId).andThen((location) => {
    const outside = location === null ? null : outsideOf(draft, location);
    if (outside === null || outside.weekdays.length === 0) {
      return okAsync(draft);
    }
    const bag = createBookingErrorBag();
    outside.weekdays.forEach((weekday) => {
      bag.add(dayPath('availability', weekday), outside.code);
    });
    return errAsync(bag.toError());
  });
}

/**
 * Where a resource's hours reach beyond the frame it must stay in: the opening
 * hours, and for an employee the hours employees may work there when the
 * location narrows them. An employee with no hours of their own follows the
 * opening hours, which does not fit once employees' hours are narrowed.
 */
function outsideOf(draft: BookableResourceDraft, location: BookingLocation) {
  const isEmployee = draft.type === 'employee';
  const hasStaffHours = isEmployee && location.staffHours !== null;
  const frame = isEmployee ? employeeHoursOf(location) : location.openingHours;
  const own = draft.availability ?? (hasStaffHours ? location.openingHours : null);
  return {
    weekdays: own === null ? [] : weekdaysOutside(own, frame),
    code: hasStaffHours ? CODES.hoursOutsideStaffHours : CODES.hoursOutsideLocation,
  };
}

function outsideEveryOffer(
  own: AvailabilityPlan,
  offered: readonly BookingLocation[],
): ReadonlySet<(typeof WEEKDAYS)[number]> {
  return new Set(offered.flatMap((location) => weekdaysOutside(own, location.openingHours)));
}

/** A service's own hours must fit the opening hours of every location that offers it. */
export function checkServiceFitsLocations(
  deps: Pick<BookingDependencies, 'locations'>,
  { tenantId, websiteId }: Scope,
  draft: BookableServiceDraft,
): AppResultAsync<BookableServiceDraft, FitError> {
  const own = draft.availability;
  if (own === null) {
    return okAsync(draft);
  }
  return deps.locations
    .listByWebsite(websiteId, tenantId, MAX_LOCATIONS_PER_WEBSITE)
    .andThen((locations) => {
      const offered = locations.filter((location) => draft.locationIds.includes(location.id));
      const outside = outsideEveryOffer(own, offered);
      if (outside.size === 0) {
        return okAsync(draft);
      }
      const bag = createBookingErrorBag();
      outside.forEach((weekday) => {
        bag.add(dayPath('availability', weekday), CODES.hoursOutsideLocation);
      });
      return errAsync(bag.toError());
    });
}

/**
 * New opening hours must not leave anything at the location open while the
 * location is closed: the services offered there, and the rooms, equipment
 * and employees placed there, all keep their own hours inside. Their hours are
 * changed first, then the location's; the days at fault are reported on the
 * opening hours.
 */
export function checkLocationKeepsDependents(
  deps: Pick<BookingDependencies, 'services' | 'resources'>,
  { tenantId, websiteId }: Scope,
  subject: { readonly locationId: BookingLocationId; readonly draft: BookingLocationDraft },
): AppResultAsync<BookingLocationDraft, FitError> {
  const { locationId, draft } = subject;
  return deps.services
    .listByWebsite(websiteId, tenantId, MAX_SERVICES_PER_WEBSITE)
    .andThen((services) =>
      deps.resources
        .listByWebsite(websiteId, tenantId, MAX_RESOURCES_PER_WEBSITE)
        .map((resources) => {
          const plans = [
            ...services
              .filter((service) => service.locationIds.includes(locationId))
              .map((service) => service.availability),
            ...resources
              // Employees follow the hours employees may work (see `retargetEmployees`).
              .filter(
                (resource) => resource.locationId === locationId && resource.type !== 'employee',
              )
              .map((resource) => resource.availability),
          ];
          return new Set(
            plans.flatMap((plan) =>
              plan === null ? [] : weekdaysOutside(plan, draft.openingHours),
            ),
          );
        }),
    )
    .andThen((outside) => {
      if (outside.size === 0) {
        return okAsync(draft);
      }
      const bag = createBookingErrorBag();
      outside.forEach((weekday) => {
        bag.add(dayPath('openingHours', weekday), CODES.hoursUsedByOthers);
      });
      return errAsync(bag.toError());
    });
}
