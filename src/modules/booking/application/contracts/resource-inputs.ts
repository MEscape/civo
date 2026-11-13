import type { OpeningHoursInput } from './location-inputs';

/**
 * What a caller sends to create or change a physical resource, as plain values. Its times use the
 * shape of a location's hours (`HH:mm` on the location's wall clock, days as `YYYY-MM-DD`), so the
 * same editors fill both; a resource's exceptions are blocks, closed days only. All of it is
 * untrusted until `parseResourceInput` has read it; nothing names a tenant or a website.
 */
export interface ResourceInput {
  readonly name: string;
  /** How many bookings it takes at once. */
  readonly capacity: number;
  readonly setupMinutes: number;
  readonly teardownMinutes: number;
  /** For the managers only; empty text: none. */
  readonly internalNote: string;
  /** Usable whenever the location is open; `openingHours.weekly` is then ignored. */
  readonly followsLocation: boolean;
  readonly openingHours: OpeningHoursInput;
}

export interface CreateResourceInput extends ResourceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  /** A kind of `RESOURCE_TYPES` other than `employee`. */
  readonly type: string;
}

export interface GetResourceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly resourceId: string;
}

export interface UpdateResourceInput extends ResourceInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly resourceId: string;
  /** The `version` of the `ResourceView` the form was filled from. */
  readonly expectedVersion: string;
  /**
   * The manager has seen the bookings this change leaves without the resource and lets them stand.
   * Nothing is cancelled or moved either way; without it, a change that affects bookings is refused.
   */
  readonly acknowledgeImpact: boolean;
}

/** The resource as it would become, to ask which existing bookings the change would affect. */
export interface PreviewResourceChangeInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly resourceId: string;
  readonly resource: ResourceInput;
}

export interface ListResourcesInput {
  /** The website the work is in, authorized by the use case before anything is read. */
  readonly websiteId: string;
  readonly locationId: string;
  readonly search?: string | undefined;
  readonly type?: string | undefined;
  /** The page asked for, as the address carries it: untrusted, resolved and clamped by the use case. */
  readonly page: { readonly page?: unknown; readonly pageSize?: unknown };
}
