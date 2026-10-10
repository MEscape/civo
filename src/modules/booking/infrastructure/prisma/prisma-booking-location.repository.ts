import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { createPersistenceFailures, dateToInstant, toJsonValue } from '@lib/db';
import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { combine, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES,
  locationNotFound,
  websiteNotFoundForBooking,
} from '../../domain/errors/booking-errors';
import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';

import { LOCATION_SELECT, toLocation } from './booking-location-record-mapper';
import { locationsOf, createInWebsite } from './tenant-ownership';

import type { BookingLocation, BookingLocationDraft } from '../../domain/models/booking-location';
import type { BookingLocationId, WebsiteId } from '../../domain/models/ids';
import type { BookingLocationRepository } from '../../domain/ports/booking-location.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'Booking location',
});

/** The columns a draft writes, in the shape the database holds them. */
function toColumns(draft: BookingLocationDraft) {
  return {
    name: draft.name,
    address: draft.address,
    timeZone: draft.timeZone,
    openingHours: toJsonValue(toAvailabilityPlanInput(draft.openingHours)),
    isActive: draft.isActive,
  };
}

/**
 * Prisma 8 repository for locations. Every query starts from
 * `locationsOf(tenantId)`, so another tenant's id is "not found". `updatedAt`
 * has no `@updatedAt` in the schema; the injected clock sets it on every write.
 */
export class PrismaBookingLocationRepository implements BookingLocationRepository {
  constructor(private readonly clock: Clock) {}

  findById(
    id: BookingLocationId,
    tenantId: TenantId,
  ): AppResultAsync<BookingLocation | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        locationsOf(tenantId)
          .select(...LOCATION_SELECT)
          .where({ id })
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toLocation(record)));
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookingLocation[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        locationsOf(tenantId)
          .select(...LOCATION_SELECT)
          .where({ websiteId })
          // `id` breaks ties so the order is stable between requests.
          .orderBy([(location) => location.name.asc(), (location) => location.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).andThen((records) => combine(records.map((record) => toLocation(record))));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookingLocationDraft;
  }): AppResultAsync<BookingLocation, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    const now = dateToInstant(this.clock.now());

    return fromThrowableAsync(
      () =>
        createInWebsite(tenantId, draft.websiteId, (tx) =>
          tx.orm.public.BookingLocation.select(...LOCATION_SELECT).create({
            tenantId,
            websiteId: draft.websiteId,
            ...toColumns(draft),
            createdAt: now,
            updatedAt: now,
          }),
        ),
      failures.infraOnly('create'),
    )
      .andThen(failures.requireRow(websiteNotFoundForBooking))
      .andThen(toLocation);
  }

  update(
    id: BookingLocationId,
    tenantId: TenantId,
    draft: BookingLocationDraft,
  ): AppResultAsync<BookingLocation, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        locationsOf(tenantId)
          .select(...LOCATION_SELECT)
          .where({ id })
          .update({ ...toColumns(draft), updatedAt: dateToInstant(this.clock.now()) }),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(locationNotFound))
      .andThen(toLocation);
  }
}
