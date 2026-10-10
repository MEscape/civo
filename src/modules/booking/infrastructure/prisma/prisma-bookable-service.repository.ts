import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES,
  serviceNotFound,
  websiteNotFoundForBooking,
} from '../../domain/errors/booking-errors';
import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';

import { SERVICE_SELECT, toService } from './bookable-service-record-mapper';
import { restoreAll } from './restore-all-record-mapper';
import { toJsonValue } from './stored-json-record-mapper';
import { servicesOf } from './tenant-ownership';

import type { BookableService, BookableServiceDraft } from '../../domain/models/bookable-service';
import type { BookableServiceId, WebsiteId } from '../../domain/models/ids';
import type { BookableServiceRepository } from '../../domain/ports/bookable-service.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'Bookable service',
});

function toColumns(draft: BookableServiceDraft) {
  return {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    isActive: draft.isActive,
    durationMinutes: draft.durationMinutes,
    preparationMinutes: draft.preparationMinutes,
    cleanupMinutes: draft.cleanupMinutes,
    slotIntervalMinutes: draft.slotIntervalMinutes,
    locationIds: toJsonValue(draft.locationIds),
    requirements: toJsonValue(draft.requirements),
    participantsPerBooking: draft.capacity.participantsPerBooking,
    participantsPerSession: draft.capacity.participantsPerSession,
    noticeMinutes: draft.noticeMinutes,
    horizonDays: draft.horizonDays,
    availability:
      draft.availability === null ? null : toJsonValue(toAvailabilityPlanInput(draft.availability)),
    cancellation: toJsonValue(draft.cancellation),
    rescheduling: toJsonValue(draft.rescheduling),
    information: toJsonValue(draft.information),
    requiredDocuments: toJsonValue(draft.requiredDocuments),
    instructions: draft.instructions,
  };
}

/** Prisma 8 repository for services; tenant scoping and clocks work as in the location repository. */
export class PrismaBookableServiceRepository implements BookableServiceRepository {
  constructor(private readonly clock: Clock) {}

  findById(
    id: BookableServiceId,
    tenantId: TenantId,
  ): AppResultAsync<BookableService | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        servicesOf(tenantId)
          .select(...SERVICE_SELECT)
          .where({ id })
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toService(record)));
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookableService[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        servicesOf(tenantId)
          .select(...SERVICE_SELECT)
          .where({ websiteId })
          .orderBy([(service) => service.name.asc(), (service) => service.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).andThen((records) => restoreAll(records, toService));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookableServiceDraft;
  }): AppResultAsync<BookableService, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    const now = dateToInstant(this.clock.now());

    return fromThrowableAsync(async () => {
      const website = await db.orm.public.Website.where({ id: draft.websiteId, tenantId })
        .select('id')
        .first();
      if (website === null) {
        return null;
      }
      return db.orm.public.BookableService.select(...SERVICE_SELECT).create({
        tenantId,
        websiteId: draft.websiteId,
        ...toColumns(draft),
        createdAt: now,
        updatedAt: now,
      });
    }, failures.infraOnly('create'))
      .andThen(failures.requireRow(websiteNotFoundForBooking))
      .andThen(toService);
  }

  update(
    id: BookableServiceId,
    tenantId: TenantId,
    draft: BookableServiceDraft,
  ): AppResultAsync<BookableService, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        servicesOf(tenantId)
          .select(...SERVICE_SELECT)
          .where({ id })
          .update({ ...toColumns(draft), updatedAt: dateToInstant(this.clock.now()) }),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(serviceNotFound))
      .andThen(toService);
  }
}
