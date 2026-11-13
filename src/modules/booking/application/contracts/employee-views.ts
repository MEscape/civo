import type { BookingLabelsView, EmployeeBookingView } from './booking-views';
import type { CALENDAR_CHANGED, MessageKind } from '../../domain/models/actor-message';
import type { ManagerChangePart } from '../../domain/models/employee-calendar';

/**
 * What the employee's own area answers with. Instants are ISO-8601 text on the wall clock of the
 * booking's location with its zone named, as in `booking-views.ts`; days are `YYYY-MM-DD`. "Now",
 * "today" and "next" are decided on the server from its clock, never in the browser.
 */

/** Where a booking of the day stands against the clock; not a status (BD-04). */
export const DAY_PLAN_PHASES = ['done', 'missed', 'past', 'now', 'upcoming'] as const;
export type DayPlanPhase = (typeof DAY_PLAN_PHASES)[number];

export interface DayPlanItemView {
  readonly booking: EmployeeBookingView;
  readonly labels: BookingLabelsView;
  readonly phase: DayPlanPhase;
  /** What the citizen brings, and what to check: from the service. */
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  /** The employee may give it back (a service whose bookings employees take, not over yet). */
  readonly mayHandBack: boolean;
  /** The appointment has begun and is still confirmed: the employee may record that it took place, or that nobody came. */
  readonly mayRecordOutcome: boolean;
}

/** One stretch of the day, on the wall clock of the location with its offset. */
export interface DayStretchView {
  readonly start: string;
  readonly end: string;
}

/** When the employee works that day: from the first start to the last end, and the pauses between. */
export interface WorkdayView extends DayStretchView {
  readonly breaks: readonly DayStretchView[];
}

export interface DayPlanView {
  /** The day shown. */
  readonly date: string;
  /** The employee's today, on the clock of their location. */
  readonly today: string;
  /** The zone the day is read in. */
  readonly timeZone: string;
  readonly items: readonly DayPlanItemView[];
  /** The next appointment that has not started, and in how many minutes; only on today. */
  readonly next: { readonly bookingId: string; readonly minutesUntil: number } | null;
  /** The day's working hours and the breaks in them; `null` on a day off (or without a calendar). */
  readonly workday: WorkdayView | null;
  /** False when the person has no calendar: nothing is planned for them, and nothing can be. */
  readonly hasCalendar: boolean;
}

interface MessageViewBase {
  readonly id: string;
  readonly locationName: string | null;
  /** The location's zone: the times are read on its clock. */
  readonly timeZone: string;
  readonly createdAt: string;
  /** The day it arrived on, on the location's clock. */
  readonly day: string;
  readonly isRead: boolean;
}

/** A message about a booking the employee serves. */
export interface BookingMessageView extends MessageViewBase {
  readonly type: MessageKind;
  readonly bookingId: string;
  readonly serviceName: string | null;
  readonly start: string;
}

/** A message that a manager changed the employee's calendar, and which parts. */
export interface CalendarMessageView extends MessageViewBase {
  readonly type: typeof CALENDAR_CHANGED;
  readonly parts: readonly ManagerChangePart[];
}

export type MessageView = BookingMessageView | CalendarMessageView;

export interface MessagePageView {
  readonly items: readonly MessageView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
  readonly unread: number;
  /** The employee's today and yesterday, to head the days with. */
  readonly today: string;
  readonly yesterday: string;
}

export interface NamedOptionView {
  readonly id: string;
  readonly name: string;
}

export interface PreferenceServiceOptionView extends NamedOptionView {
  readonly category: string | null;
}

export interface PreferencesView {
  readonly hasCalendar: boolean;
  readonly serviceIds: readonly string[];
  /** Minutes after local midnight; `null`: no preferred part of the day. */
  readonly window: { readonly startMinute: number; readonly endMinute: number } | null;
  /** What can be chosen: the services the website offers. */
  readonly services: readonly PreferenceServiceOptionView[];
}

/** What a save of the preferences answers: what is stored now. */
export interface SavedPreferencesView extends Pick<PreferencesView, 'serviceIds' | 'window'> {
  readonly websiteId: string;
}

/** What marking messages read answers: how many it marked. */
export interface MarkedReadView {
  readonly websiteId: string;
  readonly marked: number;
}
