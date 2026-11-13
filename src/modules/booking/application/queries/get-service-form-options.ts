import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { SERVICE_LIMITS } from '../contracts/booking-constraints';
import { scopeOfActor } from '../services/booking-scope';
import { loadLocation } from '../services/load-service-at-location';
import {
  loadResourcesServing,
  qualificationsOf,
  toResourceOption,
} from '../services/service-resources';

import type { BookingAccessError } from '../../domain/ports/booking-access.port';
import type { ServiceAdminDependencies } from '../booking-dependencies';
import type { GetServiceFormOptionsInput } from '../contracts/service-inputs';
import type { ServiceFormOptionsView } from '../contracts/service-views';

export type GetServiceFormOptionsError =
  BookingAccessError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

/**
 * What a service form offers to choose from at one location: the categories already in use, the
 * qualifications employees hold, and the resources that can serve the location (employees are the
 * qualification, so they are not among them) with how many services use each. Read from the data;
 * nothing is a built-in list. Needs `booking.configure`, like the forms themselves.
 */
export class GetServiceFormOptions {
  constructor(private readonly deps: ServiceAdminDependencies) {}

  execute(
    input: GetServiceFormOptionsInput,
  ): AppResultAsync<ServiceFormOptionsView, GetServiceFormOptionsError> {
    const { access, services, resources } = this.deps;

    return access.authorizeWebsite('booking.configure', input.websiteId).andThen(({ actor }) => {
      const scope = scopeOfActor(actor);
      return loadLocation(this.deps, scope, input.locationId).andThen((location) =>
        services.listCategories(scope, SERVICE_LIMITS.listMax).andThen((known) =>
          services.countResourceUse(scope, SERVICE_LIMITS.listMax).andThen((use) =>
            loadResourcesServing(this.deps, scope, location.id).andThen((serving) =>
              // Qualifications are held across the website: a location can ask for one that only another has so far.
              resources
                .list(scope, { types: ['employee'], limit: SERVICE_LIMITS.listMax })
                .map((employees): ServiceFormOptionsView => ({
                  categories: known.categories,
                  isTruncated: known.isTruncated || use.isTruncated,
                  qualifications: qualificationsOf(employees),
                  resources: serving
                    .filter((resource) => resource.type !== 'employee')
                    .map((resource) => toResourceOption(resource, use.counts)),
                })),
            ),
          ),
        ),
      );
    });
  }
}
