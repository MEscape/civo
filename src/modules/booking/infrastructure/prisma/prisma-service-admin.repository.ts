import { createPersistenceFailures } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_ERROR_CODES as CODES,
  serviceAlreadyOffered,
  serviceNotFound,
} from '../../domain/errors/booking-errors';
import { readAdoptable, readListing } from '../transactions/service-listing-queries';
import {
  readCategories,
  readServiceNames,
  readResourceUse,
  readService,
} from '../transactions/service-lookup-queries';
import {
  writeEnablement,
  writeNewService,
  writeServiceChange,
} from '../transactions/service-write-transactions';

import type { BookableServiceId, BookingLocationId } from '../../domain/models/ids';
import type { StoredService } from '../../domain/models/stored-service';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type {
  ServiceAdminRepository,
  ServiceChange,
  ServiceWriteError,
} from '../../domain/ports/service-admin.repository';
import type { Instant } from '../../domain/time/instant';

const failures = createPersistenceFailures({
  module: 'booking.persistence',
  code: CODES.persistenceFailed,
  subject: 'Bookable service',
});

/** A read of one service, unwrapped from the mapper's result into the repository's own. */
function found(
  read: AppResult<StoredService, InfrastructureAppError> | null,
): AppResultAsync<StoredService | null, InfrastructureAppError> {
  if (read === null) {
    return okAsync(null);
  }
  return read.isOk() ? okAsync(read.value) : errAsync(read.error);
}

/**
 * The administration's access to services and to where each is switched on, bound to the tenant and
 * the website in every statement. The reads are two statements at most per list; the writes are one
 * transaction each, and a change is a compare-and-swap on the version it was read at.
 */
export class PrismaServiceAdminRepository implements ServiceAdminRepository {
  listAtLocation(scope: BookingScope, locationId: BookingLocationId, limit: number) {
    return fromThrowableAsync(
      () => readListing(scope, locationId, limit),
      failures.infraOnly('listServices'),
    );
  }

  listAdoptable(scope: BookingScope, locationId: BookingLocationId | null, limit: number) {
    return fromThrowableAsync(
      () => readAdoptable(scope, locationId, limit),
      failures.infraOnly('listAdoptableServices'),
    );
  }

  findById(
    scope: BookingScope,
    id: BookableServiceId,
  ): AppResultAsync<StoredService | null, InfrastructureAppError> {
    return fromThrowableAsync(
      () => readService(scope, id),
      failures.infraOnly('findService'),
    ).andThen(found);
  }

  listNames(scope: BookingScope, limit: number) {
    return fromThrowableAsync(
      () => readServiceNames(scope, limit),
      failures.infraOnly('listServiceNames'),
    );
  }

  listCategories(scope: BookingScope, limit: number) {
    return fromThrowableAsync(
      () => readCategories(scope, limit),
      failures.infraOnly('listCategories'),
    );
  }

  countResourceUse(scope: BookingScope, limit: number) {
    return fromThrowableAsync(
      () => readResourceUse(scope, limit),
      failures.infraOnly('countResourceUse'),
    );
  }

  create(
    scope: BookingScope,
    created: Parameters<ServiceAdminRepository['create']>[1],
    now: Instant,
  ): AppResultAsync<StoredService, InfrastructureAppError> {
    return fromThrowableAsync(
      () => writeNewService(scope, created, now),
      failures.infraOnly('createService'),
    );
  }

  enable(
    scope: BookingScope,
    request: Parameters<ServiceAdminRepository['enable']>[1],
  ): AppResultAsync<StoredService, ServiceWriteError> {
    return fromThrowableAsync(
      () => writeEnablement({ scope, ...request }),
      failures.orConflict('enableService', () => serviceAlreadyOffered()),
    ).andThen(() => this.reread(scope, request.serviceId));
  }

  save(
    scope: BookingScope,
    change: ServiceChange,
  ): AppResultAsync<StoredService, ServiceWriteError> {
    const id = change.service?.stored.id ?? change.setting?.serviceId;
    return fromThrowableAsync(
      () => writeServiceChange(scope, change),
      failures.infraOnly('saveService'),
    ).andThen((refusal) => {
      if (refusal !== null) {
        return errAsync(refusal);
      }
      return id === undefined ? errAsync(serviceNotFound()) : this.reread(scope, id);
    });
  }

  private reread(
    scope: BookingScope,
    id: BookableServiceId,
  ): AppResultAsync<StoredService, ServiceWriteError> {
    return this.findById(scope, id).andThen((service) =>
      service === null ? errAsync(serviceNotFound()) : okAsync(service),
    );
  }
}

/** The one instance the composition root wires (the adapter holds no state). */
export const prismaServiceAdminRepository = new PrismaServiceAdminRepository();
