import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { hasBookings } from '../../domain/errors/booking-errors';
import { loadAuthorizedService } from '../load-authorized-service';

import type { BookingDependencies } from '../booking-dependencies';
import type { LoadServiceError } from '../load-authorized-service';

/**
 * Removes a service that nobody has ever booked. One that has bookings, past or
 * future, is switched off instead: the bookings keep what they were made for,
 * and the answer says so (`booking.has_bookings`) rather than silently doing
 * something else.
 */
export class DeleteBookableService {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    serviceId: string,
  ): AppResultAsync<
    void,
    | LoadServiceError
    | ConflictAppError
    | ValidationAppError
    | NotFoundAppError
    | InfrastructureAppError
  > {
    const { bookings, services, audit } = this.deps;

    return loadAuthorizedService(this.deps, serviceId, 'booking.configure').andThen(
      ({ actor, service }) =>
        bookings
          .isReferenced({ kind: 'service', id: service.id }, actor.tenantId)
          .andThen((isReferenced) => (isReferenced ? errAsync(hasBookings()) : okAsync(undefined)))
          .andThen(() => services.deleteById(service.id, actor.tenantId))
          .map(() => {
            audit.record({
              type: 'booking.service_deleted',
              actorId: actor.id,
              tenantId: actor.tenantId,
              websiteId: service.websiteId,
              serviceId: service.id,
            });
          }),
    );
  }
}
