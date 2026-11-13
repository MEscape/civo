import type { ConflictAppError, InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES, bookingConflict } from '../../domain/errors/booking-errors';
import { confirmBooking, createHold } from '../../domain/lifecycle/booking-hold';
import { assignmentNoticesOf } from '../../domain/models/actor-message';
import { privateSessionKey } from '../../domain/models/booking-session';
import { snapshotOf } from '../../domain/models/service-snapshot';
import { normalizeEmail } from '../../domain/policies/customer-access';
import { assessSlot } from '../../domain/scheduling/slot-engine';
import { parseInstant } from '../../domain/time/instant';
import { createLocalDateRange } from '../../domain/time/local-date-range';
import { localDateOf } from '../../domain/time/time-zone';
import { toBookingView } from '../booking-view-mappers';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { announce } from '../services/announce';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { HOLD_DURATION } from '../services/hold-duration';
import { withinActorLimit } from '../services/limit-actor';
import { loadBookable } from '../services/load-bookable';
import { recordLostRace } from '../services/persist-change';
import { parseStart } from '../services/request-parsing';
import { retryOnLostRace } from '../services/retry-on-stale';
import { loadScheduling } from '../services/scheduling-context';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { BookingWriteError, StoredBooking } from '../../domain/ports/booking.repository';
import type { BookingDependencies } from '../booking-dependencies';
import type { CreateBookingAsStaffInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { ActorLimitError } from '../services/limit-actor';
import type { BookableContextError } from '../services/load-bookable';
import type { SchedulingError } from '../services/scheduling-context';

export type CreateBookingAsStaffError =
  | BookingAccessError
  | ActorLimitError
  | BookableContextError
  | ValidationAppError
  | SchedulingError
  | ConflictAppError
  | BookingWriteError
  | InfrastructureAppError;

/**
 * A manager books a service for a customer who is not at the screen. It runs the same engine and the
 * same rules as the public flow (the slot must be free and fit the service, the details the service
 * asks for must be there), with two differences the documentation allows: the notice and the horizon
 * do not bind a manager (BD-19), and the booking is made in one step, hold and confirmation together,
 * in one write. A resource conflict still refuses it.
 *
 * Retrying is safe when the caller names the attempt (`requestKey`): the booking's id is then derived
 * from the key, the tenant and the manager, so a second try meets the first one's booking, which is
 * returned, instead of making another. Without a key every call makes a new booking.
 */
export class CreateBookingAsStaff {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: CreateBookingAsStaffInput,
  ): AppResultAsync<BookingView, CreateBookingAsStaffError> {
    const { bookings, identity, audit, clock } = this.deps;
    const now = currentInstant(clock);

    return this.deps.access
      .authorizeWebsite('booking.manage', input.websiteId)
      .andThen(({ actor }) => withinActorLimit(this.deps, BOOKING_RATE_LIMITS.staffActor, actor))
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return loadBookable(this.deps, scope, {
          serviceId: input.serviceId,
          locationId: input.locationId,
          channel: 'staff',
        }).andThen(({ service, location }) =>
          parseStart(input.start).asyncAndThen((start) => {
            const day = localDateOf(start, location.zone);
            const range = createLocalDateRange(day, day, 1);
            if (range === null) {
              return errAsync(bookingConflict(CODES.slotUnavailable, 'The time is not available.'));
            }
            const id =
              input.requestKey === undefined
                ? identity.nextId()
                : identity.idFor([scope.tenantId, actor.id, 'create-booking', input.requestKey]);
            return retryOnLostRace(() =>
              loadScheduling(this.deps, {
                scope,
                service,
                location,
                range,
                now,
                startRules: 'staff',
              }).andThen((scheduling) => {
                const assessment = assessSlot(scheduling, start);
                return assessment.kind === 'rejected'
                  ? errAsync(bookingConflict(CODES.slotUnavailable, 'The time is not available.'))
                  : createHold({
                      id,
                      service,
                      locationId: location.id,
                      channel: 'staff',
                      slot: assessment.slot,
                      now,
                      holdMinutes: HOLD_DURATION,
                    })
                      .andThen((held) =>
                        confirmBooking({ booking: held, service, customer: input.customer, now }),
                      )
                      .asyncAndThen((booking) =>
                        bookings.create(
                          scope,
                          {
                            booking,
                            placement: {
                              reference: identity.nextReference(),
                              participants: 1,
                              sessionKey: privateSessionKey(id),
                              sessionCapacity: 1,
                              snapshot: snapshotOf(service),
                            },
                            // The employee the service assigned is told, like for any assignment (BD-11).
                            notices: assignmentNoticesOf(null, booking),
                            actorId: actor.id,
                          },
                          now,
                        ),
                      );
              }),
            )
              .map((stored) => ({ stored, isReplay: false }))
              .orElse((error) =>
                error.code === CODES.referenceTaken && input.requestKey !== undefined
                  ? this.replay(scope, id, input).map((stored) => ({ stored, isReplay: true }))
                  : errAsync(error),
              )
              .mapErr(recordLostRace(this.deps, { scope, serviceId: service.id, stage: 'create' }))
              .map(({ stored, isReplay }) => {
                // A repeated request has already been recorded and announced by its first try.
                if (!isReplay) {
                  audit.record({
                    type: 'booking.confirmed',
                    tenantId: scope.tenantId,
                    websiteId: scope.websiteId,
                    actorId: actor.id,
                    bookingId: stored.booking.id,
                    serviceId: service.id,
                  });
                  announce(this.deps, {
                    kind: 'confirmed',
                    stored,
                    location,
                    websiteId: scope.websiteId,
                  });
                }
                return toBookingView(stored, location.zone, scope.websiteId);
              });
          }),
        );
      });
  }

  /**
   * The booking a first try with the same key made. Only the same request counts as a retry: the
   * same service, location, start and address. Anything else under that key is a mistake of the
   * caller and answers with the conflict.
   */
  private replay(
    scope: ReturnType<typeof scopeOfActor>,
    id: StoredBooking['booking']['id'],
    input: CreateBookingAsStaffInput,
  ): AppResultAsync<StoredBooking, BookingWriteError> {
    return this.deps.bookings.findById(scope, id).andThen((found) => {
      const same =
        found !== null &&
        found.booking.serviceId === input.serviceId &&
        found.booking.locationId === input.locationId &&
        found.booking.start === parseInstant(input.start) &&
        normalizeEmail(found.booking.customer?.email) === normalizeEmail(input.customer.email);
      return same
        ? okAsync(found)
        : errAsync(
            bookingConflict(CODES.referenceTaken, 'The request key was used for another booking.'),
          );
    });
  }
}
