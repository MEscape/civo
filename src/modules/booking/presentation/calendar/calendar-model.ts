/**
 * The neutral calendar model. The rest of the module speaks this; only
 * `calendar-adapter.client.tsx` translates it to the calendar library.
 */

export type CalendarTone = 'success' | 'info' | 'muted' | 'warning' | 'danger';

export interface CalendarAdapterEvent {
  readonly id: string;
  readonly title: string;
  /** Wall-clock `YYYY-MM-DDTHH:mm:ss` at the location. */
  readonly start: string;
  readonly end: string;
  readonly tone: CalendarTone;
}

export interface CalendarRange {
  /** First visible day, `YYYY-MM-DD`. */
  readonly from: string;
  /** Last visible day, `YYYY-MM-DD`, included. */
  readonly to: string;
}

export const CALENDAR_VIEWS = ['month', 'week', 'day', 'list'] as const;
export type CalendarViewName = (typeof CALENDAR_VIEWS)[number];

export interface CalendarLabels {
  readonly today: string;
  readonly previous: string;
  readonly next: string;
  readonly views: Readonly<Record<CalendarViewName, string>>;
  readonly viewGroup: string;
  readonly noEvents: string;
}
