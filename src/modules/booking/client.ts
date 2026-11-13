/**
 * Browser-safe public API of the booking module: the routes, the stable error codes and the types the
 * module's Server Actions answer with. Nothing here reaches the server's own code. The Server
 * Actions themselves are the module's own controls' business and are imported by them directly.
 */

export {
  BOOKING_MANAGE_PARAM,
  BOOKING_SECTION_ANCHOR,
  LOCATION_SECTIONS,
  RESOURCE_SECTIONS,
  SERVICE_SECTIONS,
  bookingRoutes,
} from './presentation/routes';
export type { LocationSection, ResourceSection, ServiceSection } from './presentation/routes';

export { BOOKING_ERROR_CODES, BOOKING_VALIDATION_CODES } from './domain/errors/booking-errors';
export { BOOKING_INPUT_LIMITS } from './application/contracts/booking-constraints';

export type {
  AssignmentCandidatesDto,
  AvailableSlotsDto,
  BookingDto,
  BookingPageDto,
  EmployeeBookingDto,
  OpenBookingDto,
  PublicBookingDto,
  OwnChangeDto,
} from './presentation/dto/booking-dto';
export type {
  BookingCatalogDto,
  CatalogLocationDto,
  CatalogServiceDto,
} from './presentation/dto/catalog-dto';
export type {
  DayPlanDto,
  DayPlanItemDto,
  MessageDto,
  MessagePageDto,
  PreferencesDto,
  SavedPreferencesDto,
} from './presentation/dto/employee-dto';
export type {
  AffectedBookingDto,
  DayDto,
  ExceptionDto,
  ExceptionInputDto,
  LocationDto,
  LocationImpactDto,
  LocationInputDto,
  LocationPageDto,
  LocationSummaryDto,
  RangeDto,
} from './presentation/dto/location-dto';
export type {
  ResourceDto,
  ResourceImpactDto,
  ResourceInputDto,
  ResourcePageDto,
  ResourceSummaryDto,
} from './presentation/dto/resource-dto';
export type {
  AdoptablePageDto,
  AdoptableServiceDto,
  DeactivationImpactDto,
  ResourceOptionDto,
  ServiceDto,
  ServiceFormOptionsDto,
  ServiceInputDto,
  ServicePageDto,
  ServiceSummaryDto,
} from './presentation/dto/service-dto';
