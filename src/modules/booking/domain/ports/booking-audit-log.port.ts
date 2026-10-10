import type { ActorId, TenantId } from '@modules/auth';

import type { ChangeActor } from '../models/bookable-service';
import type {
  BookableResourceId,
  BookableServiceId,
  BookingId,
  BookingLocationId,
  WebsiteId,
} from '../models/ids';

interface Scope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/**
 * Business facts worth keeping. Free of personal data: ids and counts only,
 * never names, e-mail addresses or the free text a visitor typed. Adding a
 * variant forces the sink's level table to be updated.
 */
export type BookingEvent =
  | (Scope & {
      readonly type: 'booking.service_created';
      readonly actorId: ActorId;
      readonly serviceId: BookableServiceId;
    })
  | (Scope & {
      readonly type: 'booking.service_updated';
      readonly actorId: ActorId;
      readonly serviceId: BookableServiceId;
    })
  | (Scope & {
      readonly type: 'booking.location_created';
      readonly actorId: ActorId;
      readonly locationId: BookingLocationId;
    })
  | (Scope & {
      readonly type: 'booking.location_updated';
      readonly actorId: ActorId;
      readonly locationId: BookingLocationId;
    })
  | (Scope & {
      readonly type: 'booking.resource_created';
      readonly actorId: ActorId;
      readonly resourceId: BookableResourceId;
    })
  | (Scope & {
      readonly type: 'booking.resource_updated';
      readonly actorId: ActorId;
      readonly resourceId: BookableResourceId;
    })
  | (Scope & {
      readonly type: 'booking.resources_imported';
      readonly actorId: ActorId;
      readonly created: number;
      readonly skipped: number;
    })
  | (Scope & {
      readonly type: 'booking.held';
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    })
  | (Scope & { readonly type: 'booking.hold_released'; readonly bookingId: BookingId })
  | (Scope & { readonly type: 'booking.holds_expired'; readonly count: number })
  | (Scope & {
      readonly type: 'booking.confirmed';
      readonly bookingId: BookingId;
      readonly serviceId: BookableServiceId;
    })
  | (Scope & {
      readonly type: 'booking.cancelled';
      readonly bookingId: BookingId;
      readonly by: ChangeActor;
    })
  | (Scope & {
      readonly type: 'booking.rescheduled';
      readonly bookingId: BookingId;
      readonly by: ChangeActor;
    })
  | (Scope & {
      readonly type: 'booking.completed';
      readonly bookingId: BookingId;
      readonly actorId: ActorId;
    })
  | (Scope & {
      readonly type: 'booking.no_show';
      readonly bookingId: BookingId;
      readonly actorId: ActorId;
    })
  | (Scope & {
      readonly type: 'booking.conflict_detected';
      readonly serviceId: BookableServiceId;
      readonly stage: 'hold' | 'confirm' | 'reschedule';
    });

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface BookingAuditLog {
  record(event: BookingEvent): void;
}
