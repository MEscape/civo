import type { ResourceKind } from './bookable-resource';
import type { BookableResourceId, BookingLocationId } from './ids';

/** One physical resource a location assigns to a service, and whether the service needs it. */
export interface ServiceResourceLink {
  readonly resourceId: BookableResourceId;
  readonly resourceType: ResourceKind;
  /** A required resource holds the slot. An optional one is never needed for a slot to be offered. */
  readonly isRequired: boolean;
}

/**
 * What belongs to one location alone when a service is switched on there: whether it runs, whether
 * it takes online bookings, and which physical resources it uses. Everything else is the service's
 * shared definition.
 */
export interface ServiceLocationSetting {
  readonly locationId: BookingLocationId;
  readonly isActive: boolean;
  readonly isOnlineBookable: boolean;
  readonly resources: readonly ServiceResourceLink[];
}
