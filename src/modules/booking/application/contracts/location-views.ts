import type { SlotView } from './booking-views';
import type { DayInput } from './location-inputs';
import type { HolidayKey } from '../../domain/holidays/german-holidays';
import type { AffectedReason } from '../../domain/impact/find-affected-bookings';
import type { ExceptionKind } from '../../domain/scheduling/availability-plan';

/**
 * What the administration of locations is answered with. Instants are ISO-8601 text on the
 * location's wall clock with their offset, with its zone named beside them; hours are `HH:mm` text,
 * the same shape the forms send back. No persistence type and no localized text.
 */
export interface LocationSummaryView {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly isActive: boolean;
  /** When the location is open today on its own clock (exceptions and breaks applied); empty: closed today. */
  readonly todayWindows: readonly SlotView[];
}

export interface LocationPageView {
  readonly items: readonly LocationSummaryView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
}

export interface ExceptionView {
  readonly kind: ExceptionKind;
  readonly from: string;
  readonly to: string;
  /** `null` for a closure. */
  readonly day: DayInput | null;
  /** The holiday this exception starts on, if any state keeps one that day: a name for the list, not stored. */
  readonly holiday: HolidayKey | null;
}

export interface LocationView {
  readonly websiteId: string;
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
  readonly isActive: boolean;
  /** Seven days, Monday first. */
  readonly weekly: readonly DayInput[];
  readonly exceptions: readonly ExceptionView[];
  /** Names the state the form was filled from; a change is refused if the location moved on. */
  readonly version: string;
  /** Confirmed bookings that have not started yet. */
  readonly futureBookingCount: number;
}

export interface AffectedBookingView {
  readonly bookingId: string;
  readonly serviceId: string;
  readonly timeZone: string;
  readonly start: string;
  readonly end: string;
  readonly reason: AffectedReason;
}

/** The existing bookings a change would leave outside the new opening hours. */
export interface LocationImpactView {
  readonly affected: readonly AffectedBookingView[];
  /** More bookings exist than one answer carries: treat the answer as incomplete. */
  readonly isTruncated: boolean;
}
