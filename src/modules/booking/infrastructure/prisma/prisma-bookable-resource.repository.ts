import type { ActorId } from '@modules/auth';

import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { combine, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { BOOKING_ERROR_CODES as CODES } from '../../domain/errors/booking-errors';
import { servesLocation } from '../../domain/models/bookable-resource';
import { compareIds } from '../../domain/models/ids';

import { RESOURCE_SELECT, toResource } from './bookable-resource-record-mapper';
import { resourcesOf } from './tenant-ownership';

import type { BookableResource } from '../../domain/models/bookable-resource';
import type { BookableResourceId } from '../../domain/models/ids';
import type {
  BookableResourceRepository,
  ResourceListQuery,
} from '../../domain/ports/bookable-resource.repository';
import type { BookingScope } from '../../domain/ports/booking.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Bookable resource',
});

/** Read-only access to the resources of a website, bound to its tenant and website in every statement. */
export class PrismaBookableResourceRepository implements BookableResourceRepository {
  findById(
    scope: BookingScope,
    id: BookableResourceId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(scope)
          .where({ id })
          .select(...RESOURCE_SELECT)
          .first(),
      failures.infraOnly('findById'),
    ).andThen((record) => (record === null ? okAsync(null) : toResource(record)));
  }

  findEmployeeOf(
    scope: BookingScope,
    actorId: ActorId,
  ): AppResultAsync<BookableResource | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourcesOf(scope)
          .where({ assignedActorId: actorId, type: 'employee', isActive: true })
          .select(...RESOURCE_SELECT)
          // Nothing in the database says "one per member"; the same one every time if there are two.
          .orderBy((resource) => resource.id.asc())
          .first(),
      failures.infraOnly('findEmployeeOf'),
    ).andThen((record) => (record === null ? okAsync(null) : toResource(record)));
  }

  list(
    scope: BookingScope,
    { servingLocationId, types, limit }: ResourceListQuery,
  ): AppResultAsync<readonly BookableResource[], InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      let query = resourcesOf(scope).select(...RESOURCE_SELECT);
      if (types !== undefined) {
        query = query.where((resource) => resource.type.in([...types]));
      }
      const page = (matching: typeof query) =>
        matching
          .orderBy((resource) => resource.id.asc())
          .limit(limit)
          .all();
      if (servingLocationId === undefined) {
        return page(query);
      }
      // The location's own resources and those that serve every location (no location of their own).
      const own = await page(query.where({ locationId: servingLocationId }));
      const shared = await page(query.where((resource) => resource.locationId.isNull()));
      // Employees sent here for some days (a few at most: only calendars that name another place).
      const sent = await page(query.where((resource) => resource.coverage.isNotNull()));
      return [...own, ...shared, ...sent]
        .filter((record, index, all) => all.findIndex(({ id }) => id === record.id) === index)
        .sort((a, b) => compareIds(a.id, b.id))
        .slice(0, limit);
    }, failures.infraOnly('list')).andThen((records) =>
      combine(records.map((record) => toResource(record))).map((resources) =>
        servingLocationId === undefined
          ? resources
          : resources.filter((resource) => servesLocation(resource, servingLocationId)),
      ),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaBookableResourceRepository = new PrismaBookableResourceRepository();
