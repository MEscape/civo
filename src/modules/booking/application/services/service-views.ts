import { originAt } from '../../domain/models/service-origin';
import { instantToDate } from '../../domain/time/instant';

import { nameView, toOriginView } from './service-names';
import { toServiceResources } from './service-resources';

import type { ServiceAtLocation } from './load-service-at-location';
import type { LocationNames } from './service-names';
import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookingLocationId, WebsiteId } from '../../domain/models/ids';
import type { StoredService } from '../../domain/models/stored-service';
import type { ServiceListEntry } from '../../domain/ports/service-admin.repository';
import type { EmployeeNeed } from '../contracts/booking-constraints';
import type { ServiceSummaryView, ServiceView } from '../contracts/service-views';

const versionOf = (instant: StoredService['updatedAt']) => instantToDate(instant).toISOString();

/** Who the employee of a service is, from its shared requirement: nobody, anyone, or someone qualified. */
export function employeeOf(service: StoredService): {
  readonly employee: EmployeeNeed;
  readonly qualification: string;
} {
  const requirement = service.requirements.find((item) => item.resourceType === 'employee');
  if (requirement === undefined) {
    return { employee: 'none', qualification: '' };
  }
  const [skill] = requirement.skills;
  return skill === undefined
    ? { employee: 'any', qualification: '' }
    : { employee: 'qualified', qualification: skill };
}

/** A service in the list of a location: enough to draw a row and say where it came from. */
export function toServiceSummary(
  entry: ServiceListEntry,
  locationId: BookingLocationId,
  names: LocationNames,
): ServiceSummaryView {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    durationMinutes: entry.durationMinutes,
    isActive: entry.isActive && entry.setting.isActive,
    isOnlineBookable: entry.setting.isOnlineBookable,
    origin: toOriginView(originAt(entry, locationId), names),
  };
}

export interface ServiceViewContext {
  readonly websiteId: WebsiteId;
  readonly found: ServiceAtLocation;
  readonly names: LocationNames;
  /** The resources that can serve the location, to name what the service uses. */
  readonly resources: readonly BookableResource[];
  readonly use: ReadonlyMap<string, number>;
  readonly futureBookingCount: number;
  readonly futureBookingCountAll: number;
}

/** A service at one location in the shape its forms edit, with the versions a change must name. */
export function toServiceView(context: ServiceViewContext): ServiceView {
  const { websiteId, found, names, resources, use } = context;
  const { service, location, setting } = found;
  return {
    websiteId,
    id: service.id,
    location: { id: location.id, name: location.name },
    name: service.name,
    description: service.description ?? '',
    category: service.category ?? '',
    documents: service.requiredDocuments,
    instructions: service.instructions ?? '',
    internalNote: service.internalNote ?? '',
    isActive: setting.isActive,
    isServiceActive: service.isActive,
    isOnlineBookable: setting.isOnlineBookable,
    durationMinutes: service.rules.durationMinutes,
    preparationMinutes: service.rules.preparationMinutes,
    cleanupMinutes: service.rules.cleanupMinutes,
    resources: toServiceResources(setting.resources, resources, use),
    noticeMinutes: service.noticeMinutes,
    horizonDays: service.horizonDays,
    cancelUntilMinutes: service.cancellation.deadlineMinutes,
    changeUntilMinutes: service.rescheduling.deadlineMinutes,
    actors: service.cancellation.allowedActors,
    ...employeeOf(service),
    origin: toOriginView(originAt(service, location.id), names),
    sharedWith: service.locations
      .filter((part) => part.locationId !== location.id)
      .flatMap((part) => nameView(part.locationId, names) ?? []),
    version: versionOf(service.updatedAt),
    settingVersion: versionOf(setting.updatedAt),
    futureBookingCount: context.futureBookingCount,
    futureBookingCountAll: context.futureBookingCountAll,
  };
}
