import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';

import { CancelBookingAsStaff } from './application/commands/cancel-booking-as-staff';
import { CancelOwnBooking } from './application/commands/cancel-own-booking';
import { CompleteBooking } from './application/commands/complete-booking';
import { ConfirmBooking } from './application/commands/confirm-booking';
import { CreateBookableResource } from './application/commands/create-bookable-resource';
import { CreateBookableService } from './application/commands/create-bookable-service';
import { CreateBookingLocation } from './application/commands/create-booking-location';
import { HoldSlot } from './application/commands/hold-slot';
import { MarkBookingNoShow } from './application/commands/mark-booking-no-show';
import { ReleaseExpiredHolds } from './application/commands/release-expired-holds';
import { ReleaseHold } from './application/commands/release-hold';
import { RescheduleBookingAsStaff } from './application/commands/reschedule-booking-as-staff';
import { RescheduleOwnBooking } from './application/commands/reschedule-own-booking';
import { UpdateBookableResource } from './application/commands/update-bookable-resource';
import { UpdateBookableService } from './application/commands/update-bookable-service';
import { UpdateBookingLocation } from './application/commands/update-booking-location';
import { GetAvailableSlots } from './application/queries/get-available-slots';
import { GetBookingAccess } from './application/queries/get-booking-access';
import { GetBookingCatalog } from './application/queries/get-booking-catalog';
import { GetBookingSetup } from './application/queries/get-booking-setup';
import { GetOperationsCalendar } from './application/queries/get-operations-calendar';
import { GetPublicBooking } from './application/queries/get-public-booking';
import { SpendRequestBudget } from './application/queries/spend-request-budget';
import { SuggestAlternativeSlots } from './application/queries/suggest-alternative-slots';
import { RandomBookingReferenceGenerator } from './infrastructure/identity/random-booking-reference-generator';
import { MemoryRequestLimiter } from './infrastructure/limiting/memory-request-limiter';
import { loggerBookingAuditLog } from './infrastructure/logging/logger-booking-audit-log';
import { PrismaBookableResourceRepository } from './infrastructure/prisma/prisma-bookable-resource.repository';
import { PrismaBookableServiceRepository } from './infrastructure/prisma/prisma-bookable-service.repository';
import { PrismaBookingLocationRepository } from './infrastructure/prisma/prisma-booking-location.repository';
import { PrismaBookingRepository } from './infrastructure/prisma/prisma-booking.repository';
import { PrismaWebsiteDirectoryRepository } from './infrastructure/prisma/prisma-website-directory.repository';

import type {
  BookingDependencies,
  BookingFlowDependencies,
  PublicBookingDependencies,
  RequestBudgetDependencies,
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

const adminDependencies: BookingDependencies = {
  authorization: getAccessControl(),
  locations,
  resources,
  services,
  bookings,
  audit: loggerBookingAuditLog,
  clock: systemClock,
};

const publicDependencies: PublicBookingDependencies = {
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
  audit: loggerBookingAuditLog,
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
  createBookableService: new CreateBookableService(adminDependencies),
  updateBookableService: new UpdateBookableService(adminDependencies),
  cancelBookingAsStaff: new CancelBookingAsStaff(adminDependencies),
  rescheduleBookingAsStaff: new RescheduleBookingAsStaff(adminDependencies),
  completeBooking: new CompleteBooking(adminDependencies),
  markBookingNoShow: new MarkBookingNoShow(adminDependencies),
  releaseExpiredHolds: new ReleaseExpiredHolds(adminDependencies),
} as const;

export const bookingAdminQueries = {
  getBookingAccess: new GetBookingAccess(adminDependencies),
  getBookingSetup: new GetBookingSetup(adminDependencies),
  getOperationsCalendar: new GetOperationsCalendar(adminDependencies),
} as const;

/** One limiter for this server process, shared by every public action (see `MemoryRequestLimiter`). */
const requestBudgetDependencies: RequestBudgetDependencies = {
  limiter: new MemoryRequestLimiter(),
  clock: systemClock,
};

/** Counted before a public action reaches its use case. */
export const bookingRequestCommands = {
  spendRequestBudget: new SpendRequestBudget(requestBudgetDependencies),
} as const;
