/**
 * Browser-safe public API of the booking module: routes and the shapes that
 * cross to the browser. Nothing here reaches server-only code.
 */
export { bookingRoutes } from './presentation/routes';

export type { PublicCatalogDto, PublicServiceDto } from './presentation/dto/catalog-dto';
export type { BookingDto } from './presentation/dto/booking-dto';
