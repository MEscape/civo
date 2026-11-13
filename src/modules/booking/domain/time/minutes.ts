import { MS_PER_MINUTE } from '@lib/utils';
import type { Brand } from '@lib/utils';

/**
 * A length of time in whole minutes: a service's duration, a buffer, a slot step, a notice. Every
 * length in the scheduling engine is minutes, and the only conversion to milliseconds is
 * `minutesToMs`, so a unit mix-up cannot compile.
 */
export type Minutes = Brand<number, 'Minutes'>;

/** One year. The longest notice a service may ask for, and the cap on every length here. */
export const MAX_MINUTES = 525_600;

/** `null` unless `value` is a whole number of minutes from 0 to `MAX_MINUTES`. */
export function parseMinutes(value: number): Minutes | null {
  // Brand constructor: the cast is only permitted here.
  return Number.isInteger(value) && value >= 0 && value <= MAX_MINUTES ? (value as Minutes) : null;
}

export function minutesToMs(minutes: Minutes): number {
  return minutes * MS_PER_MINUTE;
}
