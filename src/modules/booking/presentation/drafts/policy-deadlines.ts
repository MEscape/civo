const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

/** The deadlines offered for cancelling or moving; a saved value outside the list is kept as an extra choice. */
// eslint-disable-next-line no-magic-numbers -- the list of offered deadlines (none, 1 h, 2 h, 4 h, 1 d, 2 d, 1 week) is the data
export const DEADLINE_CHOICES = [0, 60, 120, 240, 1440, 2880, 10_080] as const;

export type DeadlineUnit = 'minute' | 'hour' | 'day' | 'week';

export interface DeadlineParts {
  readonly amount: number;
  readonly unit: DeadlineUnit;
}

/** The largest unit that divides the minutes evenly, so 1440 reads "1 day" and 90 reads "90 minutes". */
export function deadlinePartsOf(minutes: number): DeadlineParts {
  if (minutes % MINUTES_PER_WEEK === 0) {
    return { amount: minutes / MINUTES_PER_WEEK, unit: 'week' };
  }
  if (minutes % MINUTES_PER_DAY === 0) {
    return { amount: minutes / MINUTES_PER_DAY, unit: 'day' };
  }
  if (minutes % MINUTES_PER_HOUR === 0) {
    return { amount: minutes / MINUTES_PER_HOUR, unit: 'hour' };
  }
  return { amount: minutes, unit: 'minute' };
}

/** The deadlines to choose from, including the current one when it is not a standard choice. */
export function deadlineChoices(current: number): readonly number[] {
  const all = DEADLINE_CHOICES.some((choice) => choice === current)
    ? [...DEADLINE_CHOICES]
    : [...DEADLINE_CHOICES, current];
  return all.sort((a, b) => a - b);
}

/** Which sentence says what a policy allows: nobody, only staff, only customers, or both. */
export type PolicyReach = 'nobody' | 'staffOnly' | 'customersOnly' | 'customersAndStaff';

export function policyReachOf(policy: {
  readonly isAllowed: boolean;
  readonly allowedActors: readonly string[];
}): PolicyReach {
  const customers = policy.allowedActors.includes('customer');
  const staff = policy.allowedActors.includes('staff');
  if (!policy.isAllowed || (!customers && !staff)) {
    return 'nobody';
  }
  if (customers && staff) {
    return 'customersAndStaff';
  }
  return customers ? 'customersOnly' : 'staffOnly';
}
