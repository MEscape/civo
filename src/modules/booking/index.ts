/**
 * Server-side public API of the booking module. Other modules and framework entry points import
 * from here and nowhere deeper. Components that run in the browser import from `./client` instead:
 * this file reaches server-only code through `composition.ts` and must never end up in a client
 * bundle.
 *
 * The administration screens are placed by `src/app`; the visitor's journey and "my booking" are what
 * the `booking` component of the Component Platform places (`BookingSection`).
 */

/** Server-only helpers for Server Components. Mutations are reachable through Server Actions only. */
export { getBookingCommands, getBookingQueries, startBookingRetention } from './composition';

export { LocationEntryAdministration } from './presentation/components/shared/location-entry-administration';
export { BookingOverviewAdministration } from './presentation/components/shared/booking-overview-administration';
export {
  loadBookingWorkspaces,
  loadWebsiteListLinks,
} from './presentation/components/shared/workspace-reach';
export { isBookingSetupComplete } from './presentation/forms/setup-complete';
export { CoverStrip as BookingCoverStrip } from './presentation/components/employee/cover-strip';
export { BookingWorkspaceNav } from './presentation/components/shared/booking-workspace-nav';
export { BookingWorkspaces } from './presentation/components/shared/booking-workspaces';
export { BookingsAdministration } from './presentation/components/bookings/bookings-administration';
export { CalendarAdministration } from './presentation/components/calendar/calendar-administration';
export { LocationsAdministration } from './presentation/components/locations/locations-administration';
export { LocationDetailAdministration } from './presentation/components/locations/location-detail-administration';
export { LocationFormAdministration } from './presentation/components/locations/location-form-administration';
export { ServicesAdministration } from './presentation/components/services/services-administration';
export { ServiceDetailAdministration } from './presentation/components/services/service-detail-administration';
export { ServiceFormAdministration } from './presentation/components/services/service-form-administration';
export { AdoptServiceAdministration } from './presentation/components/services/adopt-service-administration';
export { ResourcesAdministration } from './presentation/components/resources/resources-administration';
export { ResourceDetailAdministration } from './presentation/components/resources/resource-detail-administration';
export { ResourceFormAdministration } from './presentation/components/resources/resource-form-administration';
export { TeamAdministration } from './presentation/components/team/team-administration';
export { TeamMemberAdministration } from './presentation/components/team/team-member-administration';
export { OwnProfileAdministration } from './presentation/components/team/own-profile-administration';
export { EmployeeStartAdministration } from './presentation/components/employee/employee-start-administration';
export {
  DayPlanAdministration,
  MessagesAdministration,
  OpenBookingsAdministration,
  PreferencesAdministration,
} from './presentation/components/employee/employee-administration';
export { BookingSection } from './presentation/components/public/booking-section';
export type { BookingSectionProps } from './presentation/components/public/booking-section';
export { bookingRoutes } from './presentation/routes';

export { default as enBooking } from './presentation/i18n/en.json';
export { default as deBooking } from './presentation/i18n/de.json';
export { BookingOverviewTile } from './presentation/components/shared/booking-overview-tile';
