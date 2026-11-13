import { toBookableServiceId, toBookingLocationId } from '../../domain/models/ids';
import { serviceLocationsOf, servicesOf } from '../prisma/tenant-ownership';

import type { BookingLocationId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  AdoptableService,
  ServiceListEntry,
  ServiceListing,
} from '../../domain/ports/service-admin.repository';

/** The columns of a service a list row needs. */
const LIST_COLUMNS = [
  'id',
  'name',
  'category',
  'isActive',
  'durationMinutes',
  'homeLocationId',
  'copiedFromLocationId',
] as const;

const optionalLocation = (id: string | null): BookingLocationId | null =>
  id === null ? null : toBookingLocationId(id);

/** The services switched on at a location, with how this location has each: two statements, never one per row. */
export async function readListing(
  scope: BookingScope,
  locationId: BookingLocationId,
  limit: number,
): Promise<ServiceListing> {
  // One more than asked for: it tells a full answer from a cut one.
  const settings = await serviceLocationsOf(scope)
    .where({ locationId })
    .select('serviceId', 'isActive', 'isOnlineBookable')
    .orderBy((row) => row.serviceId.asc())
    .limit(limit + 1)
    .all();
  const isTruncated = settings.length > limit;
  const kept = settings.slice(0, limit);
  const ids = kept.map((setting) => setting.serviceId);
  const services =
    ids.length === 0
      ? []
      : await servicesOf(scope)
          .where((service) => service.id.in(ids))
          .select(...LIST_COLUMNS)
          .all();
  const byId = new Map(services.map((service) => [service.id, service]));
  const entries = kept.flatMap((setting): ServiceListEntry[] => {
    const service = byId.get(setting.serviceId);
    return service === undefined
      ? []
      : [
          {
            id: toBookableServiceId(service.id),
            name: service.name,
            category: service.category,
            durationMinutes: service.durationMinutes,
            isActive: service.isActive,
            homeLocationId: optionalLocation(service.homeLocationId),
            copiedFromLocationId: optionalLocation(service.copiedFromLocationId),
            setting: { isActive: setting.isActive, isOnlineBookable: setting.isOnlineBookable },
          },
        ];
  });
  return { entries, isTruncated };
}

/** The services some other location has on and this one has not, each once, with where it is on. */
export async function readAdoptable(
  scope: BookingScope,
  locationId: BookingLocationId | null,
  limit: number,
): Promise<{ services: AdoptableService[]; isTruncated: boolean }> {
  // A location that is not made yet has nothing on, and nowhere is "elsewhere" from it.
  const here =
    locationId === null
      ? []
      : await serviceLocationsOf(scope)
          .where({ locationId })
          .select('serviceId')
          .limit(limit)
          .all();
  const taken = new Set(here.map((row) => row.serviceId));
  const everywhere = serviceLocationsOf(scope);
  const elsewhere = await (
    locationId === null ? everywhere : everywhere.where((row) => row.locationId.neq(locationId))
  )
    .select('serviceId', 'locationId')
    .orderBy((row) => row.serviceId.asc())
    .limit(limit + 1)
    .all();
  const isTruncated = elsewhere.length > limit;
  const offeredAt = new Map<string, BookingLocationId[]>();
  for (const row of elsewhere.slice(0, limit)) {
    if (!taken.has(row.serviceId)) {
      offeredAt.set(row.serviceId, [
        ...(offeredAt.get(row.serviceId) ?? []),
        toBookingLocationId(row.locationId),
      ]);
    }
  }
  const ids = [...offeredAt.keys()];
  const services =
    ids.length === 0
      ? []
      : await servicesOf(scope)
          .where((service) => service.id.in(ids))
          .where({ isActive: true })
          .select(...LIST_COLUMNS)
          .all();
  return {
    isTruncated,
    services: services.map((service) => ({
      id: toBookableServiceId(service.id),
      name: service.name,
      category: service.category,
      durationMinutes: service.durationMinutes,
      offeredAt: offeredAt.get(service.id) ?? [],
      homeLocationId: optionalLocation(service.homeLocationId),
    })),
  };
}
