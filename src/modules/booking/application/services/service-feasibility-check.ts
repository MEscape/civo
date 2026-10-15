import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { assessServiceFeasibility } from '../../domain/scheduling/service-feasibility';
import { MAX_LOCATIONS_PER_WEBSITE, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { WebsiteId } from '../../domain/models/ids';
import type {
  FeasibilityService,
  ServiceFeasibility,
} from '../../domain/scheduling/service-feasibility';
import type { BookingDependencies } from '../booking-dependencies';

export interface FeasibilityScope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/**
 * Loads the website's active locations and resources and asks the domain
 * whether they can serve a service's needs. Shared by the preview and the
 * guard that keeps an unservable service from being published, so both
 * answer alike. The service's `id` is `null` when it is not saved yet.
 */
export function checkServiceFeasibility(
  deps: Pick<BookingDependencies, 'locations' | 'resources'>,
  scope: FeasibilityScope,
  service: FeasibilityService,
): AppResultAsync<ServiceFeasibility, InfrastructureAppError> {
  return deps.locations
    .listByWebsite(scope.websiteId, scope.tenantId, MAX_LOCATIONS_PER_WEBSITE)
    .andThen((locations) =>
      deps.resources
        .listByWebsite(scope.websiteId, scope.tenantId, MAX_RESOURCES_PER_WEBSITE)
        .map((resources) =>
          assessServiceFeasibility({
            service,
            locations: locations.filter((location) => location.isActive),
            resources,
          }),
        ),
    );
}
