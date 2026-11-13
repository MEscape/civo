import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { err, fromThrowableAsync, ok } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  bookingDataInvalid,
} from '../../domain/errors/booking-errors';
import { toBookableResourceId } from '../../domain/models/ids';

import {
  PREFERENCE_SELECT,
  toPreferenceColumns,
  toPreferences,
} from './employee-preference-record-mapper';
import { preferencesOf, resourcesOf } from './tenant-ownership';

import type { EmployeePreferences } from '../../domain/models/employee-preferences';
import type { BookableResourceId } from '../../domain/models/ids';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { EmployeePreferenceRepository } from '../../domain/ports/employee-preference.repository';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Employee preference',
});

/** The employees' preferences, by calendar; the tenant and the website are part of every statement. */
export class PrismaEmployeePreferenceRepository implements EmployeePreferenceRepository {
  findMany(
    scope: BookingScope,
    resourceIds: readonly BookableResourceId[],
  ): AppResultAsync<ReadonlyMap<BookableResourceId, EmployeePreferences>, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        resourceIds.length === 0
          ? []
          : preferencesOf(scope)
              .where((preference) => preference.resourceId.in([...resourceIds]))
              .select(...PREFERENCE_SELECT)
              .limit(resourceIds.length)
              .all(),
      failures.infraOnly('findPreferences'),
    ).andThen((records) => {
      const found = new Map<BookableResourceId, EmployeePreferences>();
      for (const record of records) {
        const read = toPreferences(record);
        if (read.isErr()) {
          return err(read.error);
        }
        found.set(toBookableResourceId(record.resourceId), read.value);
      }
      return ok(found);
    });
  }

  save(
    scope: BookingScope,
    resourceId: BookableResourceId,
    preferences: EmployeePreferences,
  ): AppResultAsync<EmployeePreferences, InfrastructureAppError> {
    const columns = toPreferenceColumns(preferences);
    return fromThrowableAsync(async () => {
      // The calendar must be this website's: an upsert by id alone could otherwise name another one.
      const own = await resourcesOf(scope).where({ id: resourceId }).select('id').first();
      if (own === null) {
        return false;
      }
      await preferencesOf(scope)
        .select('resourceId')
        .upsert({
          create: {
            resourceId,
            tenantId: scope.tenantId,
            websiteId: scope.websiteId,
            ...columns,
          },
          update: columns,
          conflictOn: { resourceId },
        });
      return true;
    }, failures.infraOnly('savePreferences')).andThen((saved) =>
      saved ? ok(preferences) : err(bookingDataInvalid('preferences')),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaEmployeePreferenceRepository = new PrismaEmployeePreferenceRepository();
