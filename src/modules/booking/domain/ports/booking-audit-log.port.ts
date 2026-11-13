import type { ActorId, TenantId } from '@modules/auth';

import type { ChangeActor } from '../models/bookable-service';
import type { ManagerChangePart } from '../models/employee-calendar';
import type {
  BookableResourceId,
  BookableServiceId,
  BookingId,
  BookingLocationId,
  WebsiteId,
} from '../models/ids';

/**
 * Business facts worth keeping. Free of content and personal data: ids and codes, never the
 * customer's name, e-mail address or notes. An event that a signed-in member caused names them
 * (`actorId`); a visitor's has none. Every variant says where it happened (`tenantId`, `websiteId`)
 * and which booking and service it was about. Adding a variant forces the sink's level and trail
 * tables to be updated.
 */
export type BookingEvent =
  | {
      readonly type: 'booking.held';
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    }
  | {
      readonly type: 'booking.hold_released';
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    }
  | {
      readonly type: 'booking.confirmed';
      readonly actorId?: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    }
  | {
      readonly type: 'booking.cancelled';
      readonly actorId?: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
      readonly by: ChangeActor;
    }
  | {
      readonly type: 'booking.rescheduled';
      readonly actorId?: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
      readonly by: ChangeActor;
    }
  | {
      readonly type: 'booking.assigned';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
      readonly resourceId: BookableResourceId;
      /** `claim`: the employee took it; `assign`: a manager gave it. */
      readonly how: 'claim' | 'assign';
    }
  | {
      readonly type: 'booking.unassigned';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
      readonly resourceId: BookableResourceId;
    }
  | {
      readonly type: 'booking.completed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    }
  | {
      readonly type: 'booking.no_show';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    }
  | {
      readonly type: 'booking.location_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly locationId: BookingLocationId;
    }
  | {
      readonly type: 'booking.location_updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly locationId: BookingLocationId;
      /** Which parts changed, as codes: never the values. */
      readonly sections: ReadonlyArray<'details' | 'hours' | 'status'>;
      /** How many existing bookings the manager chose to leave outside the new hours. */
      readonly leftOpen: number;
    }
  | {
      readonly type: 'booking.service_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly locationId: BookingLocationId;
    }
  | {
      readonly type: 'booking.service_updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly locationId: BookingLocationId;
      /** Which part changed, as codes: `shared` reaches every location, `local` this one alone. */
      readonly parts: ReadonlyArray<'shared' | 'local'>;
    }
  | {
      readonly type: 'booking.service_adopted';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly locationId: BookingLocationId;
      readonly how: 'copy' | 'link';
    }
  | {
      readonly type: 'booking.service_deactivated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly locationId: BookingLocationId;
      readonly scope: 'location' | 'all';
      /** Bookings the manager cancelled with it, and bookings they decided to leave as they are. */
      readonly cancelled: number;
      readonly leftOpen: number;
    }
  | {
      readonly type: 'booking.service_reactivated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly locationId: BookingLocationId;
      readonly scope: 'location' | 'all';
    }
  | {
      readonly type: 'booking.resource_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
    }
  | {
      readonly type: 'booking.resource_updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
      /** Which parts changed, as codes: never the values. */
      readonly sections: ReadonlyArray<'details' | 'availability'>;
      /** How many existing bookings the manager chose to leave without the resource. */
      readonly leftOpen: number;
    }
  | {
      /** A manager set up a member's calendar at a location. */
      readonly type: 'booking.team_member_set_up';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
      /** The member whose calendar it is. */
      readonly memberId: ActorId;
    }
  | {
      /** An employee's calendar changed: by a manager, or by the employee (`actorId` is `memberId`). */
      readonly type: 'booking.team_member_updated';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
      readonly memberId: ActorId;
      /** Which parts changed, as codes: never the values. */
      readonly parts: readonly ManagerChangePart[];
      /** How many existing bookings were made open again because the employee is no longer there. */
      readonly leftOpen: number;
    }
  | {
      /** A manager took a member out of the team: their calendar is switched off and their bookings are open again. */
      readonly type: 'booking.team_member_removed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
      readonly memberId: ActorId;
      /** How many bookings were made open again. */
      readonly leftOpen: number;
    }
  | {
      /** A manager moved a member to the team of another location (`locationId` is where to). */
      readonly type: 'booking.team_member_moved';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      /** The calendar they left. */
      readonly resourceId: BookableResourceId;
      readonly locationId: BookingLocationId;
      readonly memberId: ActorId;
      /** How many bookings of the old calendar were made open again. */
      readonly leftOpen: number;
    }
  | {
      /** An employee saved where, what and when they would like to work (no values: they only sort). */
      readonly type: 'booking.preferences_saved';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly resourceId: BookableResourceId;
    }
  | {
      /** Two requests reached for the same time or the same booking and one lost. */
      readonly type: 'booking.conflict_detected';
      readonly tenantId: TenantId;
      readonly websiteId: WebsiteId;
      readonly serviceId: BookableServiceId;
      readonly stage:
        'hold' | 'confirm' | 'create' | 'reschedule' | 'assign' | 'cancel' | 'complete';
      /** The stable code the loser got. */
      readonly errorCode: string;
    };

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface BookingAuditLog {
  record(event: BookingEvent): void;
}
