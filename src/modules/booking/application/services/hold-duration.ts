import { invariant } from '@lib/utils';

import { parseMinutes } from '../../domain/time/minutes';
import { HOLD_MINUTES } from '../booking-limits';

import type { Minutes } from '../../domain/time/minutes';

const duration = parseMinutes(HOLD_MINUTES);
// A constant of this module, so a bad value is a programming error and fails at start (errors.md).
invariant(duration !== null, 'HOLD_MINUTES must be a whole number of minutes.');

/** How long a hold keeps its slot, as the rules' `Minutes`. */
export const HOLD_DURATION: Minutes = duration;
