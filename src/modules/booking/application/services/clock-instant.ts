import type { Clock } from '@lib/clock';
import { invariant } from '@lib/utils';

import { instantFromDate } from '../../domain/time/instant';

import type { Instant } from '../../domain/time/instant';

/**
 * The moment of the injected clock as the rules' `Instant`. A clock outside the supported years
 * (1969 to 2202) is a broken system clock, not a case any caller can handle, so it is an invariant
 * and not an error value (errors.md).
 */
export function currentInstant(clock: Clock): Instant {
  const instant = instantFromDate(clock.now());
  invariant(instant !== null, 'The system clock is outside the years the booking rules support.');
  return instant;
}
