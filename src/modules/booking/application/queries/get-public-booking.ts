import type { AppResultAsync } from '@lib/result';

import { toBookingView } from '../booking-view-mappers';
import { loadOwnBooking } from '../services/own-booking';
import { resolvePublicScope } from '../services/public-scope';

import type { PublicBookingDependencies } from '../booking-dependencies';
import type { BookingAccessInput } from '../contracts/booking-inputs';
import type { BookingView } from '../contracts/booking-views';
import type { OwnBookingError } from '../services/own-booking';
import type { PublicScopeError } from '../services/public-scope';

/**
 * A visitor looks up their own booking by reference and e-mail address. The
 * view says what they may still do (cancel, move) so the page can offer
 * exactly that. A wrong pair answers like an unknown reference.
 *
 * @authorization public The caller proves ownership with the booking reference and the e-mail address used to book.
 */
export class GetPublicBooking {
  constructor(private readonly deps: PublicBookingDependencies) {}

  execute(
    input: BookingAccessInput,
  ): AppResultAsync<BookingView, PublicScopeError | OwnBookingError> {
    return resolvePublicScope(this.deps, input.websiteId).andThen((scope) =>
      loadOwnBooking(this.deps, scope, input.reference, input.email).map(
        ({ booking, service, location }) =>
          toBookingView(booking, service, location, this.deps.clock.now()),
      ),
    );
  }
}
