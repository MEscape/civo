import type { BookableServiceId } from './ids';
import type { TimeRange } from '../scheduling/weekly-hours';

/**
 * What an employee would like to do. Preferences only SORT: they never make a booking ineligible
 * (BD-07; the employee screens say so in as many words). Nothing here is read by the eligibility
 * rules.
 */
export interface EmployeePreferences {
  /** The services the employee prefers. */
  readonly serviceIds: readonly BookableServiceId[];
  /** The part of the day the employee prefers, on the wall clock of the booking's location. */
  readonly window: TimeRange | null;
}
