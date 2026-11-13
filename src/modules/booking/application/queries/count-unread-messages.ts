import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { scopeOfActor } from '../services/booking-scope';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { WebsiteTargetInput } from '../contracts/booking-inputs';

export type CountUnreadMessagesError = BookingAccessError | InfrastructureAppError;

/** How many messages the signed-in member has not read: the number beside "Nachrichten". */
export class CountUnreadMessages {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: WebsiteTargetInput): AppResultAsync<number, CountUnreadMessagesError> {
    return this.deps.access
      .authorizeWebsite('booking.read.own', input.websiteId)
      .andThen(({ actor }) => this.deps.messages.countUnread(scopeOfActor(actor), actor.id));
  }
}
