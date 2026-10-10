import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { createPersistenceFailures, dateToInstant, db } from '@lib/db';
import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import { fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES,
  resourceNotFound,
  websiteNotFoundForBooking,
} from '../../domain/errors/booking-errors';
import { toAvailabilityPlanInput } from '../../domain/models/availability-plan';

import { RESOURCE_SELECT, toResource } from './bookable-resource-record-mapper';
import { restoreAll } from './restore-all-record-mapper';
import { toJsonValue } from './stored-json-record-mapper';
import { resourcesOf } from './tenant-ownership';

import type {
  BookableResource,
  BookableResourceDraft,
} from '../../domain/models/bookable-resource';
import type { BookableResourceId, WebsiteId } from '../../domain/models/ids';
import type { BookableResourceRepository } from '../../domain/ports/bookable-resource.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: BOOKING_ERROR_CODES.persistenceFailed,
  subject: 'Bookable resource',
});

function toColumns(draft: BookableResourceDraft) {
  return {
    locationId: draft.locationId,
    name: draft.name,
    type: draft.type,
    skills: toJsonValue(draft.skills),
    capacity: draft.capacity,
    availability:
      draft.availability === null ? null : toJsonValue(toAvailabilityPlanInput(draft.availability)),
    isActive: draft.isActive,
  };
}

/** Prisma 8 repository for resources; tenant scoping and clocks work as in the location repository. */
export class PrismaBookableResourceRepository implements BookableResourceRepository {
  constructor(private readonly clock: Clock) {}

  findById(
    id: BookableResourceId,
    tenantId: TenantId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(tenantId)
          .select(...RESOURCE_SELECT)
          .where({ id })
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toResource(record)));
  }

  listByWebsite(
    websiteId: WebsiteId,
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(tenantId)
          .select(...RESOURCE_SELECT)
          .where({ websiteId })
          .orderBy([(resource) => resource.name.asc(), (resource) => resource.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByWebsite'),
    ).andThen((records) => restoreAll(records, toResource));
  }

  create(input: {
    readonly tenantId: TenantId;
    readonly draft: BookableResourceDraft;
  }): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError> {
    const { tenantId, draft } = input;
    const now = dateToInstant(this.clock.now());

    return fromThrowableAsync(async () => {
      const website = await db.orm.public.Website.where({ id: draft.websiteId, tenantId })
        .select('id')
        .first();
      if (website === null) {
        return null;
      }
      return db.orm.public.BookableResource.select(...RESOURCE_SELECT).create({
        tenantId,
        websiteId: draft.websiteId,
        ...toColumns(draft),
        createdAt: now,
        updatedAt: now,
      });
    }, failures.infraOnly('create'))
      .andThen(failures.requireRow(websiteNotFoundForBooking))
      .andThen(toResource);
  }

  update(
    id: BookableResourceId,
    tenantId: TenantId,
    draft: BookableResourceDraft,
  ): AppResultAsync<BookableResource, NotFoundAppError | InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(tenantId)
          .select(...RESOURCE_SELECT)
          .where({ id })
          .update({ ...toColumns(draft), updatedAt: dateToInstant(this.clock.now()) }),
      failures.infraOnly('update'),
    )
      .andThen(failures.requireRow(resourceNotFound))
      .andThen(toResource);
  }
}
