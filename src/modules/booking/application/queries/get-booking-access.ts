import { actorHasPermission } from '@modules/auth';
import type { AuthorizationError } from '@modules/auth';

import type { AppResultAsync } from '@lib/result';

import type { BookingDependencies } from '../booking-dependencies';
import type { BookingAccessView } from '../contracts/setup-views';

/**
 * Tells a screen which actions to offer. Reading one's own bookings is the
 * entry permission, which everyone who may read bookings also holds; the
 * rest is answered from the same actor without further checks, so a person
 * with fewer rights is not logged as "denied" merely because a button was
 * hidden.
 */
export class GetBookingAccess {
  constructor(private readonly deps: BookingDependencies) {}

  execute(): AppResultAsync<BookingAccessView, AuthorizationError> {
    return this.deps.authorization.requireInTenant('booking.read.own').map((actor) => ({
      canConfigure: actorHasPermission(actor, 'booking.configure'),
      canManage: actorHasPermission(actor, 'booking.manage'),
      isOwnOnly: !actorHasPermission(actor, 'booking.read'),
    }));
  }
}
