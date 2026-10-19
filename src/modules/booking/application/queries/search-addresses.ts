import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
  fromRateLimitFailure,
} from '../../domain/errors/booking-errors';
import { ADDRESS_SEARCH_LIMITS } from '../booking-limits';
import { BOOKING_RATE_LIMITS } from '../rate-limits';

import type { BookingDependencies } from '../booking-dependencies';
import type { SearchAddressesInput } from '../contracts/booking-inputs';
import type { AddressSuggestionView } from '../contracts/setup-views';

/**
 * Suggests postal addresses to an editor typing a location's address. Only
 * someone who can configure the booking system may ask, each person has a
 * budget (the external service is paid for per call), and a query shorter than
 * a few letters is refused rather than sent. No geocoder configured is an
 * empty answer, not an error: the field then works as plain text.
 */
export class SearchAddresses {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: SearchAddressesInput,
  ): AppResultAsync<
    readonly AddressSuggestionView[],
    AuthorizationError | ValidationAppError | RateLimitedAppError | InfrastructureAppError
  > {
    const { authorization, addresses, rateLimiter } = this.deps;

    return authorization.requireInTenant('booking.configure').andThen((actor) => {
      const query = input.query.trim();
      if (
        query.length < ADDRESS_SEARCH_LIMITS.queryMin ||
        query.length > ADDRESS_SEARCH_LIMITS.queryMax
      ) {
        return errAsync(fieldValidationFailed('query', BOOKING_VALIDATION_CODES.textTooLong));
      }
      if (addresses === null) {
        return okAsync([]);
      }
      return rateLimiter
        .enforce({
          policy: BOOKING_RATE_LIMITS.searchAddress,
          subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
        })
        .mapErr(fromRateLimitFailure)
        .andThen(() =>
          addresses.search({
            query,
            language: input.language,
            limit: ADDRESS_SEARCH_LIMITS.suggestions,
          }),
        );
    });
  }
}
