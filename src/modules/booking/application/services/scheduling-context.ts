import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE } from '@lib/utils';

import { SERVICE_LIMITS } from '../../domain/models/bookable-service';
import { buildSchedulingIndex } from '../../domain/scheduling/scheduling-index';
import { addDays } from '../../domain/time/local-date';
import { startOfLocalDay } from '../../domain/time/time-zone';
import { MAX_BLOCKING_BOOKINGS_PER_QUERY, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { BookableService } from '../../domain/models/bookable-service';
import type { BookingLocation } from '../../domain/models/booking-location';
import type { BookingId } from '../../domain/models/ids';
import type { SchedulingIndex } from '../../domain/scheduling/scheduling-index';
import type { LocalDateRange } from '../../domain/scheduling/scheduling-types';
import type { PublicBookingDependencies } from '../booking-dependencies';

/** The repositories a scheduling query reads from; both the public and the admin side have them. */
export type SchedulingContextDependencies = Pick<
  PublicBookingDependencies,
  'resources' | 'bookings'
>;

export interface SchedulingContextRequest {
  readonly tenantId: TenantId;
  readonly service: BookableService;
  readonly location: BookingLocation;
  readonly range: LocalDateRange;
  readonly now: Date;
  /** A booking being moved; it must not block its own new time. */
  readonly ignoreBookingId?: BookingId | undefined;
}

/**
 * Loads what the scheduling engine needs for a span of days and builds its
 * index: the website's resources and every booking that could overlap the
 * span (a day of slack either side covers buffers and appointments across
 * midnight). The loads are bounded; the database constraint, not this read,
 * is what finally prevents a double booking, so a truncated read can cost a
 * message, never a conflict.
 */
export function loadSchedulingIndex(
  deps: SchedulingContextDependencies,
  request: SchedulingContextRequest,
): AppResultAsync<SchedulingIndex, InfrastructureAppError> {
  const { tenantId, service, location, range, now, ignoreBookingId } = request;
  const slackMs = SERVICE_LIMITS.bufferMax * MS_PER_MINUTE;
  const span = {
    start: startOfLocalDay(addDays(range.from, -1), location.timeZone) - slackMs,
    end: startOfLocalDay(addDays(range.to, 2), location.timeZone) + slackMs,
  };

  return deps.resources
    .listByWebsite(service.websiteId, tenantId, MAX_RESOURCES_PER_WEBSITE)
    .andThen((resources) =>
      deps.bookings
        .listBlocking(
          { websiteId: service.websiteId, tenantId },
          span,
          MAX_BLOCKING_BOOKINGS_PER_QUERY,
        )
        .map((bookings) =>
          buildSchedulingIndex(
            { service, location, resources, bookings, now, ignoreBookingId },
            range,
          ),
        ),
    );
}
