/**
 * Server-side public API of the booking module: scheduling for appointments
 * and resource booking. The component platform renders `BookingSection`; the
 * website admin renders `BookingAdministration`. Other modules and framework
 * entry points import from here and nowhere deeper. Browser code imports
 * from `./client`; this file reaches server-only code and must never end up
 * in a client bundle.
 */

/** Server-only queries for Server Components. */
export { bookingQueries } from './composition';

export { BookingSection } from './presentation/components/booking-section';
export { LocationWorkspacePage } from './presentation/components/location-workspace-page';
export { BookingAdministration } from './presentation/components/booking-administration';
export { BookingOverviewCard } from './presentation/components/booking-overview-card';

export { default as enBooking } from './presentation/i18n/en.json';
export { default as deBooking } from './presentation/i18n/de.json';

export type { BookingSummaryView } from './application/contracts/calendar-views';
export type { BookingSearchParams } from './presentation/components/booking-administration';
export type { BookingSectionProps } from './presentation/components/booking-section';
