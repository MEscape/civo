import type { Actor } from '@modules/auth';

import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { findSlots } from '../../domain/scheduling/slot-engine';
import { MAX_SLOTS_PER_QUERY } from '../booking-limits';
import { toSlotView } from '../booking-view-mappers';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { findBooking } from '../services/find-booking';
import { loadBookable } from '../services/load-bookable';
import { parseDateRange } from '../services/request-parsing';
import { loadScheduling } from '../services/scheduling-context';
import { whyNoSlots } from '../services/slot-emptiness';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingId } from '../../domain/models/ids';
import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingLocationFacts } from '../../domain/ports/booking-location.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { GetStaffSlotsInput } from '../contracts/booking-inputs';
import type { AvailableSlotsView } from '../contracts/booking-views';
import type { FindBookingError } from '../services/find-booking';
import type { BookableContextError } from '../services/load-bookable';
import type { SchedulingError } from '../services/scheduling-context';

export type GetStaffSlotsError =
  | BookingAccessError
  | FindBookingError
  | BookableContextError
  | ValidationAppError
  | SchedulingError;

interface SlotContext {
  readonly scope: BookingScope;
  readonly service: BookableService;
  readonly location: BookingLocationFacts;
  readonly ignoreBookingId?: BookingId;
}

/**
 * The free starts of one day for a manager, from the scheduling engine on the current hours and
 * bookings, without the notice and horizon a customer is bound by: for a new booking of a service at a
 * location, or for moving a booking (its own service and location, the booking not blocking its own
 * time). The write runs the engine again, so a start taken in between is refused there.
 */
export class GetStaffSlots {
  constructor(private readonly deps: BookingDependencies) {}

  execute(input: GetStaffSlotsInput): AppResultAsync<AvailableSlotsView, GetStaffSlotsError> {
    const now = currentInstant(this.deps.clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => this.contextOf(actor, input))
      .andThen(({ scope, service, location, ignoreBookingId }) =>
        parseDateRange({ from: input.day, to: input.day }, 1)
          .asyncAndThen((range) =>
            loadScheduling(this.deps, {
              scope,
              service,
              location,
              range,
              now,
              startRules: 'staff',
              ...(ignoreBookingId === undefined ? {} : { ignoreBookingId }),
            }),
          )
          .map((scheduling): AvailableSlotsView => {
            const slots = findSlots(scheduling);
            return {
              timeZone: location.zone,
              slots: slots
                .slice(0, MAX_SLOTS_PER_QUERY)
                .map((slot) => toSlotView({ start: slot.start, end: slot.end }, location.zone)),
              isTruncated: slots.length > MAX_SLOTS_PER_QUERY,
              ...(slots.length === 0
                ? { emptiness: whyNoSlots(scheduling, service.requirements) }
                : {}),
            };
          }),
      );
  }

  /** The booking being moved (looked up in the authorized website), or the service and location of a new one. */
  private contextOf(
    actor: Actor,
    input: GetStaffSlotsInput,
  ): AppResultAsync<SlotContext, FindBookingError | BookableContextError> {
    const scope = scopeOfActor(actor);
    if (input.bookingId !== undefined) {
      return findBooking(this.deps, actor, input.bookingId).map(
        ({ stored, service, location }) => ({
          scope,
          service,
          location,
          ignoreBookingId: stored.booking.id,
        }),
      );
    }
    return loadBookable(this.deps, scope, {
      serviceId: input.serviceId ?? '',
      locationId: input.locationId ?? '',
      channel: 'staff',
    }).map(({ service, location }) => ({ scope, service, location }));
  }
}
