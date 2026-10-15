import { WEEKDAYS } from '../../application/contracts/booking-constraints';

import type { AvailabilityPlanView } from '../../application/contracts/setup-views';
import type { AvailabilityPlanForm } from '../schemas/availability-plan-schema';

export type DayForm = AvailabilityPlanForm['weekly'][number];
export type RangeForm = DayForm['intervals'][number];
export type ExceptionForm = AvailabilityPlanForm['exceptions'][number];

export const DEFAULT_RANGE: RangeForm = { start: '09:00', end: '17:00' };
export const DEFAULT_BREAK: RangeForm = { start: '12:00', end: '13:00' };

/** A new exception starts as a one-day closure whose dates the editor still has to fill in. */
export const DEFAULT_EXCEPTION: ExceptionForm = {
  kind: 'closed',
  from: '',
  to: '',
  label: '',
  holiday: null,
};

export const NO_HOURS: DayForm = { intervals: [], breaks: [] };

/** Monday to Friday: the days "copy Monday" fills in. */
const WORKING_WEEKDAYS = 5;

/** An empty plan: closed all week, no exceptions. */
export const EMPTY_PLAN: AvailabilityPlanForm = {
  weekly: WEEKDAYS.map(() => NO_HOURS),
  exceptions: [],
};

/** The editor's form for a stored plan; a missing plan starts empty. */
export function planFormOf(view: AvailabilityPlanView | null | undefined): AvailabilityPlanForm {
  // The view and the form describe the same plan; the form's arrays are mutable where the view's are readonly.
  return view === null || view === undefined ? EMPTY_PLAN : (view as AvailabilityPlanForm);
}

/** The plan with Monday's hours copied onto every working day. */
export function withMondayOnWorkdays(plan: AvailabilityPlanForm): AvailabilityPlanForm {
  const [monday] = plan.weekly;
  if (monday === undefined) {
    return plan;
  }
  return {
    ...plan,
    weekly: plan.weekly.map((day, index) => (index < WORKING_WEEKDAYS ? monday : day)),
  };
}

/** What a day looks like when an exception turns from "closed" to "different hours". */
export function openDay(day: DayForm | undefined): DayForm {
  return day ?? { intervals: [DEFAULT_RANGE], breaks: [] };
}

const day = (start: string, end: string, breaks: readonly RangeForm[] = []): DayForm => ({
  intervals: [{ start, end }],
  breaks: [...breaks],
});

const LUNCH_BREAK: RangeForm = { start: '12:00', end: '12:30' };

/**
 * Starting points for a week, so a new resource does not begin from nothing:
 * the editor picks the closest one and adjusts. Monday first, seven days.
 */
export const AVAILABILITY_PRESETS = {
  office: [
    day('08:00', '16:00', [LUNCH_BREAK]),
    day('08:00', '16:00', [LUNCH_BREAK]),
    day('08:00', '16:00', [LUNCH_BREAK]),
    day('08:00', '16:00', [LUNCH_BREAK]),
    day('08:00', '14:00'),
    NO_HOURS,
    NO_HOURS,
  ],
  mornings: [
    day('08:00', '12:00'),
    day('08:00', '12:00'),
    day('08:00', '12:00'),
    day('08:00', '12:00'),
    day('08:00', '12:00'),
    NO_HOURS,
    NO_HOURS,
  ],
  everyDay: Array.from({ length: WEEKDAYS.length }, () => day('09:00', '17:00')),
} as const satisfies Record<string, readonly DayForm[]>;

export type AvailabilityPresetKey = keyof typeof AVAILABILITY_PRESETS;

export const AVAILABILITY_PRESET_KEYS = Object.keys(AVAILABILITY_PRESETS).filter(
  (key): key is AvailabilityPresetKey => Object.hasOwn(AVAILABILITY_PRESETS, key),
);

/** The plan with its weekly pattern replaced by a preset; exceptions (closures, absences) are kept. */
export function withPreset(
  plan: AvailabilityPlanForm,
  key: AvailabilityPresetKey,
): AvailabilityPlanForm {
  return { ...plan, weekly: [...AVAILABILITY_PRESETS[key]] };
}

/** Whether a plan has no opening hours at all: the state a new resource's plan is in. */
export function isEmptyPlan(plan: AvailabilityPlanForm): boolean {
  return plan.exceptions.length === 0 && plan.weekly.every((d) => d.intervals.length === 0);
}
