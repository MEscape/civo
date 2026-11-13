import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/** A hold's lifetime (`HOLD_MINUTES`); this file imports nothing from the module. */
const HOLD_LIFETIME_MINUTES = 10;

/**
 * Budgets of what a visitor can repeat on the public booking pages, per client address, and of the
 * writes a signed-in person makes, per person. Generous for reading availability, strict for what
 * reserves something, reveals a booking or changes one.
 *
 * A visitor's address cannot always be determined (a proxy that is not set up), and these budgets
 * are not the only protection: a booking needs a reference and its e-mail address, the live holds
 * and bookings are capped, and the database refuses a double booking. Each client budget therefore
 * skips an unresolved address instead of refusing every visitor, except holding: the hold budget is
 * what keeps one visitor from filling the website's cap on live holds, so a visitor nobody can
 * count is not let past it.
 *
 * Searching and holding fail open when the store is down: a short gap costs less than turning
 * citizens away from the only way to book, and the caps above still bound the harm. Everything that
 * will send a mail, looks a booking up, changes one or is a signed-in person's write fails closed.
 */
export const BOOKING_RATE_LIMITS = {
  /** Availability reads the schedule of a whole range. */
  searchClient: {
    id: 'booking.search-client',
    limit: 120,
    windowSeconds: SECONDS_PER_MINUTE,
    // @fail-open reading free times reserves nothing, and citizens must not be turned away from the only way to book
    onBackendFailure: 'allow',
    onUnresolvedClient: 'skip',
  },
  /**
   * Holds per address over a hold's lifetime (`HOLD_MINUTES`), so one address keeps at most twice
   * the limit alive at once (fixed windows) and cannot fill the website's cap
   * (`MAX_LIVE_HOLDS_PER_WEBSITE`) for everyone else. Ten is several changes of mind per booking.
   */
  holdClient: {
    id: 'booking.hold-client',
    limit: 10,
    windowSeconds: HOLD_LIFETIME_MINUTES * SECONDS_PER_MINUTE,
    // @fail-open a hold expires in minutes and the live holds of a website are capped, so a gap costs little
    onBackendFailure: 'allow',
    // Like the other visitor policies: without an address source nothing can be counted per
    // address, and the website's cap on live holds (`MAX_LIVE_HOLDS_PER_WEBSITE`) still applies.
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
  /** Cancelling, moving and giving a hold back: each is a write and most will send a mail. */
  changeClient: {
    id: 'booking.change-client',
    limit: 10,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
    onUnresolvedClient: 'skip',
  },
  /** An employee taking or handing back bookings: a script must not sweep every open booking. */
  claimActor: {
    id: 'booking.claim-actor',
    limit: 30,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** An employee's own settings and inbox: saving preferences, marking messages read. */
  employeeActor: {
    id: 'booking.employee-actor',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
  /** A manager's writes: creating, cancelling, moving, assigning and closing bookings. */
  staffActor: {
    id: 'booking.staff-actor',
    limit: 60,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'deny',
  },
} as const satisfies Record<string, RateLimitPolicy>;
