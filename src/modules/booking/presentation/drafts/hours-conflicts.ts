import { clipToParents, rangesOf, spansOf } from '../timeline/spans';

import type { DayForm } from './availability-plan-form';
import type { Span } from '../timeline/spans';

function isCovered(span: Span, frame: readonly Span[]): boolean {
  return frame.some((open) => open.start <= span.start && span.end <= open.end);
}

/** The days (Monday first, by index) on which `own` is open at a time `frame` is closed. */
export function daysOutside(own: readonly DayForm[], frame: readonly DayForm[]): readonly number[] {
  return own.flatMap((day, index) => {
    const open = spansOf(frame[index]?.intervals ?? []);
    return spansOf(day.intervals).some((span) => !isCovered(span, open)) ? [index] : [];
  });
}

/**
 * Whether a service's or resource's own week reaches beyond the location's. It
 * is the browser's early view of the rule the server enforces when a location
 * is saved, so what would be refused is marked while it is being edited; a
 * week that follows the location (`null`) can never be outside it.
 */
export function isOutside(
  own: readonly DayForm[] | null | undefined,
  frame: readonly DayForm[],
): boolean {
  return own !== null && own !== undefined && daysOutside(own, frame).length > 0;
}

/**
 * The week `own` cut to what `frame` allows: every day keeps only the parts
 * inside the frame's hours, and breaks only what is left of them. Used when the
 * frame changes under a week being edited, so the week is never left reaching
 * beyond it.
 */
export function clipWeek(own: readonly DayForm[], frame: readonly DayForm[]): DayForm[] {
  return own.map((day, index) => {
    const open = spansOf(frame[index]?.intervals ?? []);
    const intervals = clipToParents(spansOf(day.intervals), open);
    return {
      ...day,
      intervals: rangesOf(intervals),
      breaks: rangesOf(clipToParents(spansOf(day.breaks), intervals)),
    };
  });
}
