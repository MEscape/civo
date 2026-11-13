/** A length of time as a person says it: a whole number of one unit. */
export interface SpokenLength {
  readonly unit: 'minutes' | 'hours' | 'days';
  readonly count: number;
}

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** 90 minutes, 24 hours and 3 days: the biggest unit that divides the length without a rest. */
export function speakLength(minutes: number): SpokenLength {
  if (minutes >= MINUTES_PER_DAY && minutes % MINUTES_PER_DAY === 0) {
    return { unit: 'days', count: minutes / MINUTES_PER_DAY };
  }
  if (minutes >= MINUTES_PER_HOUR && minutes % MINUTES_PER_HOUR === 0) {
    return { unit: 'hours', count: minutes / MINUTES_PER_HOUR };
  }
  return { unit: 'minutes', count: minutes };
}

/* eslint-disable no-magic-numbers -- the choices themselves are the definition */
/** What the selects of the service form offer. Every value is whole minutes (days for the horizon). */
export const LENGTH_CHOICES = {
  duration: [5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120, 180, 240],
  buffer: [0, 5, 10, 15, 20, 30, 45, 60, 90, 120],
  /** How long before the appointment booking closes or a change is still allowed. */
  lead: [0, 60, 120, 240, 480, 720, 1440, 2880, 4320, 10_080, 20_160],
  horizonDays: [7, 14, 30, 60, 90, 120, 180, 270, 365, 540, 730],
} as const;
/* eslint-enable no-magic-numbers -- the rule applies again after the choices */

/** The choices, plus the value the service already has when it is not one of them (kept, never lost). */
export function withCurrent(choices: readonly number[], current: number): number[] {
  return choices.includes(current) ? [...choices] : [...choices, current].sort((a, b) => a - b);
}
