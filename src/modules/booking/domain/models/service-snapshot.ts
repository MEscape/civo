import type { BookableService, ServiceRequirement } from './bookable-service';

/**
 * What a service was when a booking was made: its name, its length and buffers, and the
 * requirements its units refer to. A later change of the service is for new bookings only, so what
 * the booking shows and who may take its open units are read from here and not from the service as
 * it is now.
 */
export interface ServiceSnapshot {
  readonly serviceName: string;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly requirements: readonly ServiceRequirement[];
}

/** The snapshot of a service as booked: pass the service at its location, so the requirements are the ones the units were made for. */
export function snapshotOf(service: BookableService): ServiceSnapshot {
  return {
    serviceName: service.name,
    durationMinutes: service.rules.durationMinutes,
    preparationMinutes: service.rules.preparationMinutes,
    cleanupMinutes: service.rules.cleanupMinutes,
    requirements: service.requirements,
  };
}

/** The service as the booking was made: its own requirements, whatever the service has now. */
export function serviceAsBooked(
  service: BookableService,
  snapshot: ServiceSnapshot | null,
): BookableService {
  return snapshot === null ? service : { ...service, requirements: snapshot.requirements };
}
