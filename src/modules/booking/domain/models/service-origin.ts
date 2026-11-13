import type { BookingLocationId } from './ids';
import type { StoredService } from './stored-service';

/**
 * How a service came to be at a location. A service made at a location is that location's `own`
 * (a copy says where it was taken from, for display: it is independent from the moment it is made).
 * Everywhere else it was switched on, it is `linked` to where it was made: the same definition.
 */
export type ServiceOrigin =
  | { readonly kind: 'own' }
  | { readonly kind: 'copy'; readonly fromLocationId: BookingLocationId }
  | { readonly kind: 'linked'; readonly homeLocationId: BookingLocationId };

export function originAt(
  service: Pick<StoredService, 'homeLocationId' | 'copiedFromLocationId'>,
  locationId: BookingLocationId,
): ServiceOrigin {
  const { homeLocationId, copiedFromLocationId } = service;
  if (homeLocationId !== null && homeLocationId !== locationId) {
    return { kind: 'linked', homeLocationId };
  }
  return copiedFromLocationId === null
    ? { kind: 'own' }
    : { kind: 'copy', fromLocationId: copiedFromLocationId };
}

/** Whether the shared definition is the location's own to change alone (it is not shared with anybody). */
export function isSharedElsewhere(service: Pick<StoredService, 'locations'>): boolean {
  return service.locations.length > 1;
}
