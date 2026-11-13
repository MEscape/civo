import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { BOOKING_ID_MAX_LENGTH } from '../../domain/models/ids';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { scopeOfActor } from '../services/booking-scope';
import { currentInstant } from '../services/clock-instant';
import { withinActorLimit } from '../services/limit-actor';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { EmployeeAreaDependencies } from '../booking-dependencies';
import type { MarkMessagesReadInput } from '../contracts/employee-inputs';
import type { MarkedReadView } from '../contracts/employee-views';
import type { ActorLimitError } from '../services/limit-actor';

export type MarkMessagesReadError =
  BookingAccessError | ActorLimitError | ValidationAppError | InfrastructureAppError;

/**
 * Marks one of the signed-in member's messages read, or all of them. Only their own: the member is
 * the session's, and another member's message id changes nothing. Repeating it changes nothing.
 * Answers how many were marked.
 *
 * @audit-exempt reading one's own inbox changes nothing anyone else sees or relies on.
 */
export class MarkMessagesRead {
  constructor(private readonly deps: EmployeeAreaDependencies) {}

  execute(input: MarkMessagesReadInput): AppResultAsync<MarkedReadView, MarkMessagesReadError> {
    const { messageId } = input;
    const now = currentInstant(this.deps.clock);
    return this.deps.access
      .authorizeWebsite('booking.read.own', input.websiteId)
      .andThen(({ actor }) =>
        messageId !== null && (messageId.length === 0 || messageId.length > BOOKING_ID_MAX_LENGTH)
          ? errAsync(fieldValidationFailed('messageId', CODES.idInvalid))
          : withinActorLimit(this.deps, BOOKING_RATE_LIMITS.employeeActor, actor),
      )
      .andThen((actor) => {
        const scope = scopeOfActor(actor);
        return this.deps.messages
          .markRead(scope, actor.id, { messageId, now })
          .map((marked) => ({ websiteId: scope.websiteId, marked }));
      });
  }
}
