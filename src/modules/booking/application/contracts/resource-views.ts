import type { SlotView } from './booking-views';
import type { DayInput } from './location-inputs';
import type { AffectedBookingView } from './location-views';
import type { LocationNameView } from './service-views';
import type { PhysicalResourceKind } from '../../domain/ports/resource-admin.repository';

/**
 * What the administration of physical resources is answered with. Instants are ISO-8601 text on the
 * location's wall clock with their offset, hours `HH:mm` text, days `YYYY-MM-DD`: the shapes the
 * forms send back. No persistence type and no localized text.
 */

/** A service that uses the resource at its location. */
export interface ResourceUseView {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly isRequired: boolean;
}

/** A stretch of today during which the resource is in use, and whether every place is taken. */
export interface ResourceBusyView extends SlotView {
  readonly isFull: boolean;
}

/** How the resource is used today, on its location's clock. */
export interface ResourceTodayView {
  readonly timeZone: string;
  /** From the first opening to the last closing of the location today; `null`: closed today. */
  readonly window: SlotView | null;
  readonly busy: readonly ResourceBusyView[];
  /** The most bookings that hold it at one moment today. */
  readonly peak: number;
}

/** `blocked`: a block covers today (maintenance); `inactive`: switched off. */
export type ResourceStatus = 'active' | 'blocked' | 'inactive';

export interface ResourceSummaryView {
  readonly id: string;
  readonly name: string;
  readonly type: PhysicalResourceKind;
  /** How many bookings it takes at once. */
  readonly places: number;
  readonly status: ResourceStatus;
  readonly usedBy: readonly ResourceUseView[];
  readonly today: ResourceTodayView;
}

export interface ResourcePageView {
  readonly location: LocationNameView;
  readonly items: readonly ResourceSummaryView[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly pageCount: number;
}

export interface ResourceBlockView {
  readonly from: string;
  /** Last day covered, included. */
  readonly to: string;
}

/** A resource in the shape its forms edit, and the version a change must name. */
export interface ResourceView extends ResourceSummaryView {
  readonly websiteId: string;
  readonly location: LocationNameView;
  readonly setupMinutes: number;
  readonly teardownMinutes: number;
  readonly internalNote: string;
  readonly followsLocation: boolean;
  /** Seven days, Monday first: its own week, or the location's when it follows it. */
  readonly weekly: readonly DayInput[];
  /** The location's week, for saying what "like the location" means. */
  readonly locationWeekly: readonly DayInput[];
  readonly blocks: readonly ResourceBlockView[];
  readonly version: string;
}

/** The existing bookings a change would leave without the resource. */
export interface ResourceImpactView {
  readonly affected: readonly AffectedBookingView[];
  /** More bookings exist than one answer carries: treat the answer as incomplete. */
  readonly isTruncated: boolean;
}
