import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets of what a visitor can repeat on the public booking pages, per client address, and of the
 * paid address lookup an editor triggers by typing, per signed-in person. Generous for reading
 * availability, strict for what reserves something, sends a mail or reveals a booking.
 *
 * A visitor's address cannot always be determined (a proxy that is not set up), and these
 * budgets are not the only protection: a booking needs a reference and its e-mail address, the
 * live holds and bookings are capped, and the database refuses a double booking. Each client budget
 * therefore skips an unresolved address instead of refusing every visitor.
 *
 * Searching and holding fail open when the store is down: a short gap costs less than turning
 * citizens away from the only way to book, and the caps above still bound the harm. Everything that
 * sends a mail, looks a booking up or costs money per call fails closed.
 */
export const BOOKING_RATE_LIMITS = {
  /** Availability and alternative times share one budget: both read the same schedule. */
  searchClient: {
    id: 'booking.search-client',
    limit: 120,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'allow',
    onUnresolvedClient: 'skip',
  },
  holdClient: {
    id: 'booking.hold-client',
    limit: 12,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'allow',
    onUnresolvedClient: 'skip',
  },
  confirmClient: {
    id: 'booking.confirm-client',
    limit: 12,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  /** Finding a booking by reference and e-mail address: a script must not be able to probe references. */
  lookupClient: {
    id: 'booking.lookup-client',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  /** Cancelling, moving and giving a hold back: each is a write and most send a mail. */
  changeClient: {
    id: 'booking.change-client',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  /** Each lookup is a call to a paid external service, made by an editor typing. */
  searchAddress: {
    id: 'booking.search-address',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
