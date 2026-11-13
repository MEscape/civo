import 'server-only';

import { headers } from 'next/headers';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';

import type { Locale } from '@i18n';

import { systemClock } from '@lib/clock';
import { publicEnv } from '@lib/config';
import { serverEnv } from '@lib/config/server';
import { getMailTransport } from '@lib/mail/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { toLocalizedPath } from '@lib/seo';
import { once } from '@lib/utils';

import { AdoptService } from './application/commands/adopt-service';
import { AssignEmployee } from './application/commands/assign-employee';
import { CancelBooking } from './application/commands/cancel-booking';
import { CancelOwnBooking } from './application/commands/cancel-own-booking';
import { ClaimBooking } from './application/commands/claim-booking';
import { CompleteBooking } from './application/commands/complete-booking';
import { CompleteOwnBooking } from './application/commands/complete-own-booking';
import { ConfirmBooking } from './application/commands/confirm-booking';
import { CreateBookableResource } from './application/commands/create-bookable-resource';
import { CreateBookableService } from './application/commands/create-bookable-service';
import { CreateBookingAsStaff } from './application/commands/create-booking-as-staff';
import { CreateBookingLocation } from './application/commands/create-booking-location';
import { DeactivateService } from './application/commands/deactivate-service';
import { HandBackBooking } from './application/commands/hand-back-booking';
import { HoldSlot } from './application/commands/hold-slot';
import { MarkBookingNoShow } from './application/commands/mark-booking-no-show';
import { MarkMessagesRead } from './application/commands/mark-messages-read';
import { MarkOwnBookingNoShow } from './application/commands/mark-own-booking-no-show';
import { MoveTeamMember } from './application/commands/move-team-member';
import { ReactivateService } from './application/commands/reactivate-service';
import { ReleaseHold } from './application/commands/release-hold';
import { RemoveTeamMember } from './application/commands/remove-team-member';
import { RescheduleBooking } from './application/commands/reschedule-booking';
import { RescheduleOwnBooking } from './application/commands/reschedule-own-booking';
import { SaveEmployeePreferences } from './application/commands/save-employee-preferences';
import { SaveOwnProfile } from './application/commands/save-own-profile';
import { SetUpTeamMember } from './application/commands/set-up-team-member';
import { UnassignEmployee } from './application/commands/unassign-employee';
import { UpdateBookableResource } from './application/commands/update-bookable-resource';
import { UpdateBookableService } from './application/commands/update-bookable-service';
import { UpdateBookingLocation } from './application/commands/update-booking-location';
import { UpdateTeamMember } from './application/commands/update-team-member';
import { CountUnreadMessages } from './application/queries/count-unread-messages';
import { GetAssignmentCandidates } from './application/queries/get-assignment-candidates';
import { GetAvailableSlots } from './application/queries/get-available-slots';
import { GetBooking } from './application/queries/get-booking';
import { GetBookingCalendar } from './application/queries/get-booking-calendar';
import { GetBookingCatalog } from './application/queries/get-booking-catalog';
import { GetBookingChoices } from './application/queries/get-booking-choices';
import { GetBookingNames } from './application/queries/get-booking-names';
import { GetBookingSetup } from './application/queries/get-booking-setup';
import { GetEmployeeDayPlan } from './application/queries/get-employee-day-plan';
import { GetEmployeePreferences } from './application/queries/get-employee-preferences';
import { GetLocation } from './application/queries/get-location';
import { GetMyBookings } from './application/queries/get-my-bookings';
import { GetOpenBookings } from './application/queries/get-open-bookings';
import { GetOwnBookingSlots } from './application/queries/get-own-booking-slots';
import { GetOwnProfile } from './application/queries/get-own-profile';
import { GetPublicBooking } from './application/queries/get-public-booking';
import { GetResource } from './application/queries/get-resource';
import { GetService } from './application/queries/get-service';
import { GetServiceFormOptions } from './application/queries/get-service-form-options';
import { GetStaffSlots } from './application/queries/get-staff-slots';
import { GetTeam } from './application/queries/get-team';
import { GetTeamMember } from './application/queries/get-team-member';
import { ListAdoptableServices } from './application/queries/list-adoptable-services';
import { ListBookings } from './application/queries/list-bookings';
import { ListLocations } from './application/queries/list-locations';
import { ListMessages } from './application/queries/list-messages';
import { ListOfferableServices } from './application/queries/list-offerable-services';
import { ListResources } from './application/queries/list-resources';
import { ListServices } from './application/queries/list-services';
import { ListWorkspaces } from './application/queries/list-workspaces';
import { PreviewLocationChange } from './application/queries/preview-location-change';
import { PreviewOwnProfileChange } from './application/queries/preview-own-profile-change';
import { PreviewResourceChange } from './application/queries/preview-resource-change';
import { PreviewServiceDeactivation } from './application/queries/preview-service-deactivation';
import { PreviewTeamMemberChange } from './application/queries/preview-team-member-change';
import { PreviewTeamMemberRemoval } from './application/queries/preview-team-member-removal';
import { pruneBookings } from './application/services/prune-bookings';
import { AuthBookingAccess } from './infrastructure/access/auth-booking-access';
import { authBookingWorkspaces } from './infrastructure/access/auth-booking-workspaces';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerBookingAuditLog,
} from './infrastructure/audit/logger-booking-audit-log';
import { authTeamDirectory } from './infrastructure/identity/auth-team-directory';
import { randomBookingIdentityGenerator } from './infrastructure/identity/random-booking-identity-generator';
import { startDailyRetention } from './infrastructure/jobs/daily-retention';
import { EmailBookingNotifier } from './infrastructure/notification/email-booking-notifier';
import { skippedBookingNotifier } from './infrastructure/notification/skipped-booking-notifier';
import { readWebsiteMailIdentity } from './infrastructure/notification/website-mail-identity';
import { prismaActorMessageRepository } from './infrastructure/prisma/prisma-actor-message.repository';
import { prismaBookableResourceRepository } from './infrastructure/prisma/prisma-bookable-resource.repository';
import { prismaBookableServiceRepository } from './infrastructure/prisma/prisma-bookable-service.repository';
import { prismaBookingCatalogRepository } from './infrastructure/prisma/prisma-booking-catalog.repository';
import { prismaBookingLocationRepository } from './infrastructure/prisma/prisma-booking-location.repository';
import { prismaBookingRetentionRepository } from './infrastructure/prisma/prisma-booking-retention.repository';
import { prismaBookingRepository } from './infrastructure/prisma/prisma-booking.repository';
import { prismaEmployeePreferenceRepository } from './infrastructure/prisma/prisma-employee-preference.repository';
import { prismaLocationAdminRepository } from './infrastructure/prisma/prisma-location-admin.repository';
import { prismaResourceAdminRepository } from './infrastructure/prisma/prisma-resource-admin.repository';
import { prismaServiceAdminRepository } from './infrastructure/prisma/prisma-service-admin.repository';
import { prismaTeamRepository } from './infrastructure/prisma/prisma-team.repository';
import { prismaWebsiteDirectoryRepository } from './infrastructure/prisma/prisma-website-directory.repository';
import { BOOKING_MANAGE_PARAM, BOOKING_SECTION_ANCHOR, bookingRoutes } from './presentation/routes';

import type {
  BookingDependencies,
  BookingFlowDependencies,
  EmployeeAreaDependencies,
  LocationAdminDependencies,
  ResourceAdminDependencies,
  ServiceAdminDependencies,
  TeamDependencies,
} from './application/booking-dependencies';
import type { BookingNotice, BookingNotifier } from './domain/ports/booking-notifier.port';

/**
 * The module's composition root: the one file that knows both the use cases and their adapters.
 * Presentation and framework entry points reach use cases only through here, so they never import
 * infrastructure. `server-only` turns an accidental import from a Client Component into a build
 * error.
 *
 * Two dependency sets, on purpose. The protected use cases (managers, employees) get the
 * authorization service and nothing of the visitor's side. The public flow gets the website
 * directory and the client address instead, and no authorization service: a visitor has no actor, the
 * tenant comes from the website's own record, and the booking is reached by its reference and
 * address. Both share the stores, the audit sink, the notifier and the limiter.
 */
const auditLog = withAuditTrail(loggerBookingAuditLog, {
  source: 'booking',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

/** The link of a booking message: the website opens "my booking" with the reference filled in. */
const manageLink = (locale: Locale, slug: string, reference: string) => {
  const link = new URL(
    toLocalizedPath(locale, bookingRoutes.publicSite(slug)),
    publicEnv.NEXT_PUBLIC_APP_URL,
  );
  link.searchParams.set(BOOKING_MANAGE_PARAM, reference);
  link.hash = BOOKING_SECTION_ANCHOR;
  return link.toString();
};

/**
 * E-mail through the shared transport, or a logged skip while `MAIL_PROVIDER=none`. Decided on first
 * use, so importing this needs no mail settings at build time.
 */
const bookingNotifier = once((): BookingNotifier => {
  const transport = getMailTransport();
  return transport === null
    ? skippedBookingNotifier
    : new EmailBookingNotifier(transport, {
        clock: systemClock,
        readWebsite: readWebsiteMailIdentity,
        manageLink,
      });
});

/**
 * The stores every use case shares. Built when first requested, like auth and media: building the
 * app needs neither the rate limiter's store nor the mail settings.
 */
const getStores = once(() => ({
  bookings: prismaBookingRepository,
  services: prismaBookableServiceRepository,
  resources: prismaBookableResourceRepository,
  locations: prismaBookingLocationRepository,
  audit: auditLog,
  clock: systemClock,
  rateLimiter: getRateLimiter(),
  notifier: { notify: (notice: BookingNotice) => bookingNotifier().notify(notice) },
  identity: randomBookingIdentityGenerator,
}));

const getAccess = once(() => new AuthBookingAccess(getAuthQueries, getAccessControl()));

const getDependencies = once((): BookingDependencies => ({
  ...getStores(),
  access: getAccess(),
  preferences: prismaEmployeePreferenceRepository,
}));

/** The employee's own area: the inbox, and the names and instructions a booking is shown with. */
const getEmployeeDependencies = once((): EmployeeAreaDependencies => ({
  ...getDependencies(),
  messages: prismaActorMessageRepository,
  locationAdmin: prismaLocationAdminRepository,
  serviceAdmin: prismaServiceAdminRepository,
}));

/** What the administration use cases (locations, resources, the team) share, besides their own stores. */
const getAdminBase = once(() => {
  const { clock, rateLimiter, audit, bookings } = getStores();
  return { access: getAccess(), clock, rateLimiter, audit, bookings };
});

const getLocationDependencies = once((): LocationAdminDependencies => ({
  ...getAdminBase(),
  locations: prismaLocationAdminRepository,
}));

const getServiceDependencies = once((): ServiceAdminDependencies => {
  const { notifier, resources } = getStores();
  return {
    ...getAdminBase(),
    notifier,
    services: prismaServiceAdminRepository,
    locations: prismaLocationAdminRepository,
    resources,
  };
});

const getResourceDependencies = once((): ResourceAdminDependencies => ({
  ...getAdminBase(),
  resources: prismaResourceAdminRepository,
  locations: prismaLocationAdminRepository,
}));

const getTeamDependencies = once((): TeamDependencies => ({
  ...getAdminBase(),
  team: prismaTeamRepository,
  directory: authTeamDirectory,
  locations: prismaLocationAdminRepository,
}));

const getFlowDependencies = once((): BookingFlowDependencies => ({
  ...getStores(),
  websites: prismaWebsiteDirectoryRepository,
  clientAddress: getClientAddressProvider(() => headers()),
}));

/**
 * Commands authorize the named website themselves (the protected ones) or work from the website's
 * own record (the public flow), and record their outcome in the audit trail.
 */
export const getBookingCommands = once(() => {
  const flow = getFlowDependencies();
  const staff = getDependencies();
  const employee = getEmployeeDependencies();
  const location = getLocationDependencies();
  const service = getServiceDependencies();
  const resource = getResourceDependencies();
  const team = getTeamDependencies();
  return {
    holdSlot: new HoldSlot(flow),
    confirmBooking: new ConfirmBooking(flow),
    releaseHold: new ReleaseHold(flow),
    cancelOwnBooking: new CancelOwnBooking(flow),
    rescheduleOwnBooking: new RescheduleOwnBooking(flow),
    createBookingAsStaff: new CreateBookingAsStaff(staff),
    cancelBooking: new CancelBooking(staff),
    rescheduleBooking: new RescheduleBooking(staff),
    completeBooking: new CompleteBooking(staff),
    markBookingNoShow: new MarkBookingNoShow(staff),
    assignEmployee: new AssignEmployee(staff),
    unassignEmployee: new UnassignEmployee(staff),
    claimBooking: new ClaimBooking(staff),
    handBackBooking: new HandBackBooking(staff),
    completeOwnBooking: new CompleteOwnBooking(staff),
    markOwnBookingNoShow: new MarkOwnBookingNoShow(staff),
    saveEmployeePreferences: new SaveEmployeePreferences(employee),
    markMessagesRead: new MarkMessagesRead(employee),
    createBookingLocation: new CreateBookingLocation(location),
    updateBookingLocation: new UpdateBookingLocation(location),
    createBookableService: new CreateBookableService(service),
    updateBookableService: new UpdateBookableService(service),
    adoptService: new AdoptService(service),
    deactivateService: new DeactivateService(service),
    reactivateService: new ReactivateService(service),
    createBookableResource: new CreateBookableResource(resource),
    updateBookableResource: new UpdateBookableResource(resource),
    setUpTeamMember: new SetUpTeamMember(team),
    updateTeamMember: new UpdateTeamMember(team),
    removeTeamMember: new RemoveTeamMember(team),
    moveTeamMember: new MoveTeamMember(team),
    saveOwnProfile: new SaveOwnProfile(team),
  } as const;
});

export const getBookingQueries = once(() => {
  const flow = getFlowDependencies();
  const staff = getDependencies();
  const employee = getEmployeeDependencies();
  const location = getLocationDependencies();
  const service = getServiceDependencies();
  const resource = getResourceDependencies();
  const team = getTeamDependencies();
  return {
    getAvailableSlots: new GetAvailableSlots(flow),
    getPublicBooking: new GetPublicBooking(flow),
    getOwnBookingSlots: new GetOwnBookingSlots(flow),
    getBookingCatalog: new GetBookingCatalog({ ...flow, catalog: prismaBookingCatalogRepository }),
    listBookings: new ListBookings(employee),
    getBookingCalendar: new GetBookingCalendar(employee),
    getBookingNames: new GetBookingNames(employee),
    getStaffSlots: new GetStaffSlots(staff),
    getBooking: new GetBooking(staff),
    getMyBookings: new GetMyBookings(staff),
    getOpenBookings: new GetOpenBookings(employee),
    getEmployeeDayPlan: new GetEmployeeDayPlan(employee),
    getEmployeePreferences: new GetEmployeePreferences(employee),
    listMessages: new ListMessages(employee),
    countUnreadMessages: new CountUnreadMessages(employee),
    getAssignmentCandidates: new GetAssignmentCandidates(staff),
    listWorkspaces: new ListWorkspaces({ workspaces: authBookingWorkspaces }),
    listLocations: new ListLocations(location),
    getLocation: new GetLocation(location),
    previewLocationChange: new PreviewLocationChange(location),
    listServices: new ListServices(service),
    getService: new GetService(service),
    getServiceFormOptions: new GetServiceFormOptions(service),
    getBookingChoices: new GetBookingChoices(service),
    getBookingSetup: new GetBookingSetup(service),
    listAdoptableServices: new ListAdoptableServices(service),
    listOfferableServices: new ListOfferableServices(service),
    previewServiceDeactivation: new PreviewServiceDeactivation(service),
    listResources: new ListResources(resource),
    getResource: new GetResource(resource),
    previewResourceChange: new PreviewResourceChange(resource),
    getTeam: new GetTeam(team),
    getTeamMember: new GetTeamMember(team),
    previewTeamMemberChange: new PreviewTeamMemberChange(team),
    previewTeamMemberRemoval: new PreviewTeamMemberRemoval(team),
    getOwnProfile: new GetOwnProfile(team),
    previewOwnProfileChange: new PreviewOwnProfileChange(team),
  } as const;
});

/** Keeps the bookings to their retention: at server start, then daily, as the audit trail does (see `startAuditRetention`). */
export const startBookingRetention = once((): void => {
  const retentionDays = serverEnv.BOOKING_RETENTION_DAYS;
  const retention = prismaBookingRetentionRepository;
  startDailyRetention(
    () => pruneBookings({ retention, clock: systemClock, retentionDays }),
    retentionDays,
  );
});
