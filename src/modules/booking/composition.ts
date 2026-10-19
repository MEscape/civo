import 'server-only';
import { headers } from 'next/headers';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { publicEnv } from '@lib/config';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { toLocalizedPath } from '@lib/seo';

import { AcknowledgeManagerChange } from './application/commands/acknowledge-manager-change';
import { CancelBookingAsStaff } from './application/commands/cancel-booking-as-staff';
import { CancelOwnBooking } from './application/commands/cancel-own-booking';
import { CompleteBooking } from './application/commands/complete-booking';
import { ConfirmBooking } from './application/commands/confirm-booking';
import { CreateBookableResource } from './application/commands/create-bookable-resource';
import { CreateBookableService } from './application/commands/create-bookable-service';
import { CreateBookingLocation } from './application/commands/create-booking-location';
import { DeleteBookableResource } from './application/commands/delete-bookable-resource';
import { DeleteBookableService } from './application/commands/delete-bookable-service';
import { DeleteBookingLocation } from './application/commands/delete-booking-location';
import { HoldSlot } from './application/commands/hold-slot';
import { MarkBookingNoShow } from './application/commands/mark-booking-no-show';
import { OfferServiceAtLocation } from './application/commands/offer-service-at-location';
import { ReleaseExpiredHolds } from './application/commands/release-expired-holds';
import { ReleaseHold } from './application/commands/release-hold';
import { RescheduleBookingAsStaff } from './application/commands/reschedule-booking-as-staff';
import { RescheduleOwnBooking } from './application/commands/reschedule-own-booking';
import { SaveOwnProfile } from './application/commands/save-own-profile';
import { SetStaffHours } from './application/commands/set-staff-hours';
import { SetTeamHours } from './application/commands/set-team-hours';
import { SetTeamMemberServices } from './application/commands/set-team-member-services';
import { UpdateBookableResource } from './application/commands/update-bookable-resource';
import { UpdateBookableService } from './application/commands/update-bookable-service';
import { UpdateBookingLocation } from './application/commands/update-booking-location';
import { GetAvailableSlots } from './application/queries/get-available-slots';
import { GetBookingAccess } from './application/queries/get-booking-access';
import { GetBookingCatalog } from './application/queries/get-booking-catalog';
import { GetBookingOptions } from './application/queries/get-booking-options';
import { GetBookingSummary } from './application/queries/get-booking-summary';
import { GetLocationWorkspace } from './application/queries/get-location-workspace';
import { GetOperationsCalendar } from './application/queries/get-operations-calendar';
import { GetOwnProfile } from './application/queries/get-own-profile';
import { GetPublicBooking } from './application/queries/get-public-booking';
import { GetSetupOverview } from './application/queries/get-setup-overview';
import { GetTeam } from './application/queries/get-team';
import { PreviewServiceFeasibility } from './application/queries/preview-service-feasibility';
import { ResolveBookingNames } from './application/queries/resolve-booking-names';
import { SearchAddresses } from './application/queries/search-addresses';
import { SuggestAlternativeSlots } from './application/queries/suggest-alternative-slots';
import { MapboxAddressSearch } from './infrastructure/geocoding/mapbox-address-search';
import { RandomBookingReferenceGenerator } from './infrastructure/identity/random-booking-reference-generator';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerBookingAuditLog,
} from './infrastructure/logging/logger-booking-audit-log';
import { createBookingNotifier } from './infrastructure/mail/create-booking-notifier';
import { PrismaBookableResourceRepository } from './infrastructure/prisma/prisma-bookable-resource.repository';
import { PrismaBookableServiceRepository } from './infrastructure/prisma/prisma-bookable-service.repository';
import { PrismaBookingLocationRepository } from './infrastructure/prisma/prisma-booking-location.repository';
import { PrismaBookingRepository } from './infrastructure/prisma/prisma-booking.repository';
import { PrismaWebsiteBrandRepository } from './infrastructure/prisma/prisma-website-brand.repository';
import { PrismaWebsiteDirectoryRepository } from './infrastructure/prisma/prisma-website-directory.repository';
import { bookingRoutes } from './presentation/routes';

import type {
  BookingDependencies,
  BookingFlowDependencies,
  PublicBookingDependencies,
} from './application/booking-dependencies';

/**
 * The module's composition root: the one file that knows both the use cases
 * and their adapters. Presentation and framework entry points reach use
 * cases only through here, so they never import infrastructure.
 * `server-only` turns an accidental import from a Client Component into a
 * build error.
 *
 * Three dependency sets, on purpose. The admin set carries the
 * authorization service; the public sets do not, because a visitor has no
 * actor and the tenant is read from the website instead. The commands of
 * the public flow additionally get the audit log and the reference
 * generator, so every state change is recorded.
 */
const locations = new PrismaBookingLocationRepository(systemClock);
const resources = new PrismaBookableResourceRepository(systemClock);
const services = new PrismaBookableServiceRepository(systemClock);
const bookings = new PrismaBookingRepository();
const notifier = createBookingNotifier(
  new PrismaWebsiteBrandRepository(),
  systemClock,
  (locale, slug, reference) => {
    // `manage` opens "my booking" with the reference in, on the page of the website that holds the booking.
    const link = new URL(
      toLocalizedPath(locale, bookingRoutes.publicSite(slug)),
      publicEnv.NEXT_PUBLIC_APP_URL,
    );
    link.searchParams.set('manage', reference);
    return link.toString();
  },
);
const rateLimiter = getRateLimiter();
// The map's public token also serves address suggestions; without it the address field is plain text.
const geocodingToken = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const addresses = geocodingToken === undefined ? null : new MapboxAddressSearch(geocodingToken);

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerBookingAuditLog, {
  source: 'booking',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

const adminDependencies: BookingDependencies = {
  authorization: getAccessControl(),
  locations,
  resources,
  services,
  bookings,
  audit: auditLog,
  addresses,
  rateLimiter,
  notifier,
  clock: systemClock,
};

const publicDependencies: PublicBookingDependencies = {
  rateLimiter,
  clientAddress: getClientAddressProvider(() => headers()),
  websites: new PrismaWebsiteDirectoryRepository(),
  locations,
  resources,
  services,
  bookings,
  clock: systemClock,
};

const flowDependencies: BookingFlowDependencies = {
  ...publicDependencies,
  references: new RandomBookingReferenceGenerator(),
  audit: auditLog,
  notifier,
};

/** Use cases of the public booking flow: no sign-in, scoped by the website. */
export const bookingFlowCommands = {
  holdSlot: new HoldSlot(flowDependencies),
  confirmBooking: new ConfirmBooking(flowDependencies),
  releaseHold: new ReleaseHold(flowDependencies),
  cancelOwnBooking: new CancelOwnBooking(flowDependencies),
  rescheduleOwnBooking: new RescheduleOwnBooking(flowDependencies),
} as const;

export const bookingPublicQueries = {
  getBookingCatalog: new GetBookingCatalog(publicDependencies),
  getAvailableSlots: new GetAvailableSlots(publicDependencies),
  suggestAlternativeSlots: new SuggestAlternativeSlots(publicDependencies),
  getPublicBooking: new GetPublicBooking(publicDependencies),
} as const;

/** Use cases of the admin side: every one authorizes the signed-in actor. */
export const bookingAdminCommands = {
  createBookingLocation: new CreateBookingLocation(adminDependencies),
  updateBookingLocation: new UpdateBookingLocation(adminDependencies),
  createBookableResource: new CreateBookableResource(adminDependencies),
  updateBookableResource: new UpdateBookableResource(adminDependencies),
  saveOwnProfile: new SaveOwnProfile(adminDependencies),
  createBookableService: new CreateBookableService(adminDependencies),
  updateBookableService: new UpdateBookableService(adminDependencies),
  offerServiceAtLocation: new OfferServiceAtLocation(adminDependencies),
  deleteBookingLocation: new DeleteBookingLocation(adminDependencies),
  deleteBookableService: new DeleteBookableService(adminDependencies),
  deleteBookableResource: new DeleteBookableResource(adminDependencies),
  setStaffHours: new SetStaffHours(adminDependencies),
  setTeamHours: new SetTeamHours(adminDependencies),
  setTeamMemberServices: new SetTeamMemberServices(adminDependencies),
  acknowledgeManagerChange: new AcknowledgeManagerChange(adminDependencies),
  cancelBookingAsStaff: new CancelBookingAsStaff(adminDependencies),
  rescheduleBookingAsStaff: new RescheduleBookingAsStaff(adminDependencies),
  completeBooking: new CompleteBooking(adminDependencies),
  markBookingNoShow: new MarkBookingNoShow(adminDependencies),
  releaseExpiredHolds: new ReleaseExpiredHolds(adminDependencies),
} as const;

export const bookingAdminQueries = {
  getBookingAccess: new GetBookingAccess(adminDependencies),
  getBookingOptions: new GetBookingOptions(adminDependencies),
  getOperationsCalendar: new GetOperationsCalendar(adminDependencies),
  getBookingSummary: new GetBookingSummary(adminDependencies),
  getSetupOverview: new GetSetupOverview(adminDependencies),
  getTeam: new GetTeam(adminDependencies),
  getLocationWorkspace: new GetLocationWorkspace(adminDependencies),
  getOwnProfile: new GetOwnProfile(adminDependencies),
  previewServiceFeasibility: new PreviewServiceFeasibility(adminDependencies),
  searchAddresses: new SearchAddresses(adminDependencies),
} as const;

/** What other screens may ask of the bookings: a summary with the calendar's access rule, and names by id. */
export const bookingQueries = {
  getBookingSummary: bookingAdminQueries.getBookingSummary,
  resolveBookingNames: new ResolveBookingNames(adminDependencies),
} as const;
