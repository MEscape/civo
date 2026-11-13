import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';
import type {
  BookingFlowDependencies,
  EmployeeAreaDependencies,
  ResourceAdminDependencies,
  ServiceAdminDependencies,
  TeamDependencies,
} from '@modules/booking/application/booking-dependencies';
import { AdoptService } from '@modules/booking/application/commands/adopt-service';
import { AssignEmployee } from '@modules/booking/application/commands/assign-employee';
import { CancelBooking } from '@modules/booking/application/commands/cancel-booking';
import { CancelOwnBooking } from '@modules/booking/application/commands/cancel-own-booking';
import { ClaimBooking } from '@modules/booking/application/commands/claim-booking';
import { CompleteOwnBooking } from '@modules/booking/application/commands/complete-own-booking';
import { ConfirmBooking } from '@modules/booking/application/commands/confirm-booking';
import { CreateBookableResource } from '@modules/booking/application/commands/create-bookable-resource';
import { CreateBookableService } from '@modules/booking/application/commands/create-bookable-service';
import { CreateBookingAsStaff } from '@modules/booking/application/commands/create-booking-as-staff';
import { DeactivateService } from '@modules/booking/application/commands/deactivate-service';
import { HandBackBooking } from '@modules/booking/application/commands/hand-back-booking';
import { HoldSlot } from '@modules/booking/application/commands/hold-slot';
import { MarkMessagesRead } from '@modules/booking/application/commands/mark-messages-read';
import { MarkOwnBookingNoShow } from '@modules/booking/application/commands/mark-own-booking-no-show';
import { ReactivateService } from '@modules/booking/application/commands/reactivate-service';
import { ReleaseHold } from '@modules/booking/application/commands/release-hold';
import { RescheduleBooking } from '@modules/booking/application/commands/reschedule-booking';
import { RescheduleOwnBooking } from '@modules/booking/application/commands/reschedule-own-booking';
import { SaveEmployeePreferences } from '@modules/booking/application/commands/save-employee-preferences';
import { SaveOwnProfile } from '@modules/booking/application/commands/save-own-profile';
import { SetUpTeamMember } from '@modules/booking/application/commands/set-up-team-member';
import { UnassignEmployee } from '@modules/booking/application/commands/unassign-employee';
import { UpdateBookableResource } from '@modules/booking/application/commands/update-bookable-resource';
import { UpdateBookableService } from '@modules/booking/application/commands/update-bookable-service';
import { UpdateTeamMember } from '@modules/booking/application/commands/update-team-member';
import { CountUnreadMessages } from '@modules/booking/application/queries/count-unread-messages';
import { GetAvailableSlots } from '@modules/booking/application/queries/get-available-slots';
import { GetBooking } from '@modules/booking/application/queries/get-booking';
import { GetBookingCalendar } from '@modules/booking/application/queries/get-booking-calendar';
import { GetBookingNames } from '@modules/booking/application/queries/get-booking-names';
import { GetEmployeeDayPlan } from '@modules/booking/application/queries/get-employee-day-plan';
import { GetEmployeePreferences } from '@modules/booking/application/queries/get-employee-preferences';
import { GetMyBookings } from '@modules/booking/application/queries/get-my-bookings';
import { GetOpenBookings } from '@modules/booking/application/queries/get-open-bookings';
import { GetOwnProfile } from '@modules/booking/application/queries/get-own-profile';
import { GetPublicBooking } from '@modules/booking/application/queries/get-public-booking';
import { GetResource } from '@modules/booking/application/queries/get-resource';
import { GetService } from '@modules/booking/application/queries/get-service';
import { GetServiceFormOptions } from '@modules/booking/application/queries/get-service-form-options';
import { GetStaffSlots } from '@modules/booking/application/queries/get-staff-slots';
import { GetTeam } from '@modules/booking/application/queries/get-team';
import { GetTeamMember } from '@modules/booking/application/queries/get-team-member';
import { ListAdoptableServices } from '@modules/booking/application/queries/list-adoptable-services';
import { ListBookings } from '@modules/booking/application/queries/list-bookings';
import { ListMessages } from '@modules/booking/application/queries/list-messages';
import { ListResources } from '@modules/booking/application/queries/list-resources';
import { ListServices } from '@modules/booking/application/queries/list-services';
import { PreviewOwnProfileChange } from '@modules/booking/application/queries/preview-own-profile-change';
import { PreviewResourceChange } from '@modules/booking/application/queries/preview-resource-change';
import { PreviewServiceDeactivation } from '@modules/booking/application/queries/preview-service-deactivation';
import { PreviewTeamMemberChange } from '@modules/booking/application/queries/preview-team-member-change';
import { toWebsiteId } from '@modules/booking/domain/models/ids';
import type { BookingAccess } from '@modules/booking/domain/ports/booking-access.port';
import type { BookingEvent } from '@modules/booking/domain/ports/booking-audit-log.port';
import type { BookingNotice } from '@modules/booking/domain/ports/booking-notifier.port';
import type { TeamMember } from '@modules/booking/domain/ports/team-directory.port';
import { RandomBookingIdentityGenerator } from '@modules/booking/infrastructure/identity/random-booking-identity-generator';
import { prismaActorMessageRepository } from '@modules/booking/infrastructure/prisma/prisma-actor-message.repository';
import { prismaBookableResourceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-resource.repository';
import { prismaBookableServiceRepository } from '@modules/booking/infrastructure/prisma/prisma-bookable-service.repository';
import { prismaBookingLocationRepository } from '@modules/booking/infrastructure/prisma/prisma-booking-location.repository';
import { prismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';
import { prismaEmployeePreferenceRepository } from '@modules/booking/infrastructure/prisma/prisma-employee-preference.repository';
import { prismaLocationAdminRepository } from '@modules/booking/infrastructure/prisma/prisma-location-admin.repository';
import { prismaResourceAdminRepository } from '@modules/booking/infrastructure/prisma/prisma-resource-admin.repository';
import { prismaServiceAdminRepository } from '@modules/booking/infrastructure/prisma/prisma-service-admin.repository';
import { prismaTeamRepository } from '@modules/booking/infrastructure/prisma/prisma-team.repository';
import { prismaWebsiteDirectoryRepository } from '@modules/booking/infrastructure/prisma/prisma-website-directory.repository';

import { forbiddenError, rateLimitedError } from '@lib/errors';
import type { RateLimitFailure, RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { NOW } from './booking-fixtures';

import type { World } from './persistence-fixtures';

/**
 * The booking use cases over the real repositories and a real database, with the three things that
 * live outside the module replaced: who is signed in (`actAs`), the rate limiter (`budget`) and the
 * messages that would leave the system (`notices`). Everything a use case writes is recorded so a
 * test can say what happened as well as what was answered.
 */
export interface Harness {
  readonly commands: ReturnType<typeof buildCommands> &
    ReturnType<typeof buildServiceCommands> &
    ReturnType<typeof buildResourceCommands> &
    ReturnType<typeof buildTeamCommands>;
  readonly queries: ReturnType<typeof buildQueries> &
    ReturnType<typeof buildServiceQueries> &
    ReturnType<typeof buildResourceQueries> &
    ReturnType<typeof buildTeamQueries>;
  readonly events: BookingEvent[];
  /** The members the auth directory names as employees of the signed-in tenant (the team tests fill it). */
  readonly teamMembers: TeamMember[];
  readonly notices: BookingNotice[];
  /** The next calls are made by this person; `null` is nobody signed in. */
  actAs(actor: Actor | null): void;
  /** Lets `allowed` more attempts through, then refuses the rest. */
  limitTo(allowed: number): void;
  /** Lets everything through again. */
  unlimit(): void;
  /** Moves the clock the use cases read to `instant` (ISO-8601); without one, back to `NOW`. */
  setNow(instant?: string): void;
  /** The policies the limiter was asked to enforce, in order. */
  readonly enforced: string[];
}

export function actorOf(world: World, role: Role, key = role): Actor {
  const tenantId = String(world.scope.tenantId);
  return { id: toActorId(`actor-${key}`), tenantId: toTenantId(tenantId), roles: [role] };
}

/** Anna, as the person behind her employee resource. */
export function employeeActor(world: World, who: 'anna' | 'ben'): Actor {
  return {
    id: toActorId(world.actors[who]),
    tenantId: toTenantId(String(world.scope.tenantId)),
    roles: ['employee'],
  };
}

function buildCommands(flow: BookingFlowDependencies, staff: EmployeeAreaDependencies) {
  return {
    holdSlot: new HoldSlot(flow),
    confirmBooking: new ConfirmBooking(flow),
    releaseHold: new ReleaseHold(flow),
    cancelOwnBooking: new CancelOwnBooking(flow),
    rescheduleOwnBooking: new RescheduleOwnBooking(flow),
    createBookingAsStaff: new CreateBookingAsStaff(staff),
    cancelBooking: new CancelBooking(staff),
    rescheduleBooking: new RescheduleBooking(staff),
    assignEmployee: new AssignEmployee(staff),
    unassignEmployee: new UnassignEmployee(staff),
    claimBooking: new ClaimBooking(staff),
    handBackBooking: new HandBackBooking(staff),
    completeOwnBooking: new CompleteOwnBooking(staff),
    markOwnBookingNoShow: new MarkOwnBookingNoShow(staff),
    saveEmployeePreferences: new SaveEmployeePreferences(staff),
    markMessagesRead: new MarkMessagesRead(staff),
  };
}

function buildServiceCommands(admin: ServiceAdminDependencies) {
  return {
    createBookableService: new CreateBookableService(admin),
    updateBookableService: new UpdateBookableService(admin),
    adoptService: new AdoptService(admin),
    deactivateService: new DeactivateService(admin),
    reactivateService: new ReactivateService(admin),
  };
}

function buildServiceQueries(admin: ServiceAdminDependencies) {
  return {
    listServices: new ListServices(admin),
    getService: new GetService(admin),
    getServiceFormOptions: new GetServiceFormOptions(admin),
    listAdoptableServices: new ListAdoptableServices(admin),
    previewServiceDeactivation: new PreviewServiceDeactivation(admin),
  };
}

function buildResourceCommands(admin: ResourceAdminDependencies) {
  return {
    createBookableResource: new CreateBookableResource(admin),
    updateBookableResource: new UpdateBookableResource(admin),
  };
}

function buildTeamCommands(team: TeamDependencies) {
  return {
    setUpTeamMember: new SetUpTeamMember(team),
    updateTeamMember: new UpdateTeamMember(team),
    saveOwnProfile: new SaveOwnProfile(team),
  };
}

function buildTeamQueries(team: TeamDependencies) {
  return {
    getTeam: new GetTeam(team),
    getTeamMember: new GetTeamMember(team),
    previewTeamMemberChange: new PreviewTeamMemberChange(team),
    getOwnProfile: new GetOwnProfile(team),
    previewOwnProfileChange: new PreviewOwnProfileChange(team),
  };
}

function buildResourceQueries(admin: ResourceAdminDependencies) {
  return {
    listResources: new ListResources(admin),
    getResource: new GetResource(admin),
    previewResourceChange: new PreviewResourceChange(admin),
  };
}

function buildQueries(flow: BookingFlowDependencies, staff: EmployeeAreaDependencies) {
  return {
    getAvailableSlots: new GetAvailableSlots(flow),
    getPublicBooking: new GetPublicBooking(flow),
    listBookings: new ListBookings(staff),
    getBookingCalendar: new GetBookingCalendar(staff),
    getBookingNames: new GetBookingNames(staff),
    getStaffSlots: new GetStaffSlots(staff),
    getBooking: new GetBooking(staff),
    getMyBookings: new GetMyBookings(staff),
    getOpenBookings: new GetOpenBookings(staff),
    getEmployeeDayPlan: new GetEmployeeDayPlan(staff),
    getEmployeePreferences: new GetEmployeePreferences(staff),
    listMessages: new ListMessages(staff),
    countUnreadMessages: new CountUnreadMessages(staff),
  };
}

export function createHarness(): Harness {
  let current: Actor | null = null;
  let remaining = Number.POSITIVE_INFINITY;
  const events: BookingEvent[] = [];
  const notices: BookingNotice[] = [];
  const enforced: string[] = [];
  let clockAt: number = NOW;

  const access: BookingAccess = {
    authorizeWebsite: (permission, rawWebsiteId) =>
      current !== null &&
      rawWebsiteId === current.tenantId &&
      actorHasPermission(current, permission)
        ? okAsync({ actor: current, websiteId: toWebsiteId(current.tenantId) })
        : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  };

  const allowance = { limit: 1, remaining: 1, resetAfterSeconds: 1, degraded: false };
  const take = (policyId: string) => {
    enforced.push(policyId);
    if (remaining <= 0) {
      return errAsync(rateLimitedError('rate_limit.exceeded', 'Slow down.', 30));
    }
    remaining -= 1;
    return okAsync(allowance);
  };
  const rateLimiter: RateLimiter = {
    enforce: ({ policy }) => take(policy.id),
    enforceAll: (requests) =>
      requests.reduce(
        (done, { policy }) => done.andThen((list) => take(policy.id).map((one) => [...list, one])),
        okAsync<ReadonlyArray<typeof allowance>, RateLimitFailure>([]),
      ),
  };

  const stores = {
    bookings: prismaBookingRepository,
    services: prismaBookableServiceRepository,
    resources: prismaBookableResourceRepository,
    locations: prismaBookingLocationRepository,
    audit: { record: (event: BookingEvent) => void events.push(event) },
    clock: { now: () => new Date(clockAt) },
    rateLimiter,
    notifier: {
      notify: (notice: BookingNotice) => {
        notices.push(notice);
        return okAsync<undefined>(undefined);
      },
    },
    identity: new RandomBookingIdentityGenerator(),
  };
  const staff: EmployeeAreaDependencies = {
    ...stores,
    access,
    preferences: prismaEmployeePreferenceRepository,
    messages: prismaActorMessageRepository,
    locationAdmin: prismaLocationAdminRepository,
    serviceAdmin: prismaServiceAdminRepository,
  };
  const serviceAdmin: ServiceAdminDependencies = {
    access,
    clock: stores.clock,
    rateLimiter,
    notifier: stores.notifier,
    audit: stores.audit,
    services: prismaServiceAdminRepository,
    locations: prismaLocationAdminRepository,
    resources: stores.resources,
    bookings: stores.bookings,
  };
  const resourceAdmin: ResourceAdminDependencies = {
    access,
    clock: stores.clock,
    rateLimiter,
    audit: stores.audit,
    resources: prismaResourceAdminRepository,
    locations: prismaLocationAdminRepository,
    bookings: stores.bookings,
  };
  const teamMembers: TeamMember[] = [];
  const team: TeamDependencies = {
    access,
    clock: stores.clock,
    rateLimiter,
    audit: stores.audit,
    team: prismaTeamRepository,
    // Like the auth module's query: only those who set up the bookings may list the employees.
    directory: {
      listEmployees: (websiteId) =>
        access
          .authorizeWebsite('booking.configure', websiteId)
          .map(() => ({ members: [...teamMembers], isTruncated: false })),
    },
    locations: prismaLocationAdminRepository,
    bookings: stores.bookings,
  };
  const flow: BookingFlowDependencies = {
    ...stores,
    websites: prismaWebsiteDirectoryRepository,
    clientAddress: { current: () => Promise.resolve({ kind: 'client', address: '203.0.113.7' }) },
  };

  return {
    commands: {
      ...buildCommands(flow, staff),
      ...buildServiceCommands(serviceAdmin),
      ...buildResourceCommands(resourceAdmin),
      ...buildTeamCommands(team),
    },
    queries: {
      ...buildQueries(flow, staff),
      ...buildServiceQueries(serviceAdmin),
      ...buildResourceQueries(resourceAdmin),
      ...buildTeamQueries(team),
    },
    events,
    teamMembers,
    notices,
    enforced,
    actAs: (actor) => {
      current = actor;
    },
    limitTo: (allowed) => {
      remaining = allowed;
    },
    unlimit: () => {
      remaining = Number.POSITIVE_INFINITY;
    },
    setNow: (instant) => {
      clockAt = instant === undefined ? NOW : Date.parse(instant);
    },
  };
}
