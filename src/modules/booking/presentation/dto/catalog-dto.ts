import type { InformationField } from '../../application/contracts/booking-constraints';
import type {
  PublicCatalogView,
  PublicServiceView,
} from '../../application/contracts/catalog-views';

export interface PublicLocationDto {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timeZone: string;
}

export interface PublicServiceDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: string | null;
  readonly durationMinutes: number;
  readonly locations: readonly PublicLocationDto[];
  readonly maxParticipantsPerBooking: number;
  readonly information: ReadonlyArray<{
    readonly field: InformationField;
    readonly isRequired: boolean;
  }>;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly horizonDays: number;
  readonly cancellationAllowed: boolean;
  readonly cancellationDeadlineMinutes: number;
}

export interface PublicCatalogDto {
  readonly services: readonly PublicServiceDto[];
}

export function toPublicLocationDto(
  view: PublicServiceView['locations'][number],
): PublicLocationDto {
  return {
    id: view.id,
    name: view.name,
    address: view.address,
    timeZone: view.timeZone,
  };
}

export function toPublicServiceDto(service: PublicServiceView): PublicServiceDto {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    category: service.category,
    durationMinutes: service.durationMinutes,
    locations: service.locations.map(toPublicLocationDto),
    maxParticipantsPerBooking: service.maxParticipantsPerBooking,
    information: service.information.map(({ field, isRequired }) => ({ field, isRequired })),
    requiredDocuments: service.requiredDocuments,
    instructions: service.instructions,
    horizonDays: service.horizonDays,
    cancellationAllowed: service.cancellationAllowed,
    cancellationDeadlineMinutes: service.cancellationDeadlineMinutes,
  };
}

/** The catalog is already plain data; the DTO fixes the shape that crosses to the browser. */
export function toPublicCatalogDto(view: PublicCatalogView): PublicCatalogDto {
  return { services: view.services.map(toPublicServiceDto) };
}
