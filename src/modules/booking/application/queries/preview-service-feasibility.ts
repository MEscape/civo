import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { createServiceNeeds } from '../../domain/models/bookable-service';
import { parseBookableServiceId, parseWebsiteId } from '../../domain/models/ids';
import { checkServiceFeasibility } from '../services/service-feasibility-check';

import type { BookableServiceId } from '../../domain/models/ids';
import type { BookingDependencies } from '../booking-dependencies';
import type { PreviewServiceFeasibilityInput } from '../contracts/booking-inputs';
import type { ServiceFeasibilityView } from '../contracts/setup-views';

/**
 * Tells a person configuring a service whether the resources that exist can
 * serve it, and when not, which requirement fails and why. It answers from the
 * domain's own eligibility rule, never from a copy in the form. Opening hours
 * and existing bookings are not part of it: they decide whether a time is free,
 * not whether the service can work at all.
 */
export class PreviewServiceFeasibility {
  constructor(private readonly deps: BookingDependencies) {}

  execute(
    input: PreviewServiceFeasibilityInput,
  ): AppResultAsync<
    ServiceFeasibilityView,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    const { authorization } = this.deps;

    return authorization.requireInTenant('booking.configure').andThen((actor) =>
      parseWebsiteId(input.websiteId).asyncAndThen((websiteId) =>
        parseOptionalServiceId(input.serviceId)
          .andThen((serviceId) => createServiceNeeds(input).map((needs) => ({ serviceId, needs })))
          .asyncAndThen(({ serviceId, needs }) =>
            checkServiceFeasibility(
              this.deps,
              { tenantId: actor.tenantId, websiteId },
              { id: serviceId, ...needs },
            ),
          ),
      ),
    );
  }
}

function parseOptionalServiceId(
  raw: string | undefined,
): AppResult<BookableServiceId | null, ValidationAppError> {
  return raw === undefined ? ok(null) : parseBookableServiceId(raw);
}
