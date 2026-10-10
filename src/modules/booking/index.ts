/**
 * Server-side public API of the booking module: scheduling for appointments
 * and resource booking. The component platform renders `BookingSection`; the
 * website admin renders `BookingAdministration`. Other modules and framework
 * entry points import from here and nowhere deeper. Browser code imports
 * from `./client`; this file reaches server-only code and must never end up
 * in a client bundle.
 */

export { BookingSection } from './presentation/components/booking-section';
export { BookingAdministration } from './presentation/components/booking-administration';
export { bookingRoutes } from './presentation/routes';

export { default as enBooking } from './presentation/i18n/en.json';
export { default as deBooking } from './presentation/i18n/de.json';

export type { BookingSectionProps } from './presentation/components/booking-section';
