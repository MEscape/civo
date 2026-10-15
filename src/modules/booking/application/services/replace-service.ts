import type { Actor } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { createBookableServiceDraft } from '../../domain/models/bookable-service';

import { checkServiceFitsLocations } from './hours-fit-checks';
import { checkServiceReference } from './reference-checks';
import { requireBookableWhenActive } from './require-bookable-when-active';

import type { BookableService, BookableServiceInput } from '../../domain/models/bookable-service';
import type { BookingDependencies } from '../booking-dependencies';

/**
 * Replaces the configuration of a service the actor may configure: the one
 * path every change to a stored service takes, so a change of one field and a
 * change of the whole form are held to the same rules (valid values, known
 * locations and resources, and a service that is switched on can work
 * somewhere). Bookings already made keep the times they were made for. The
 * caller records what it did.
 */
export function replaceService(
  deps: BookingDependencies,
  subject: { readonly actor: Actor; readonly service: BookableService },
  input: Omit<BookableServiceInput, 'websiteId'>,
): AppResultAsync<BookableService, ValidationAppError | NotFoundAppError | InfrastructureAppError> {
  const { actor, service } = subject;
  const scope = { tenantId: actor.tenantId, websiteId: service.websiteId };

  return createBookableServiceDraft({ ...input, websiteId: service.websiteId })
    .asyncAndThen((draft) => checkServiceReference(deps, scope, draft))
    .andThen((draft) => checkServiceFitsLocations(deps, scope, draft))
    .andThen((draft) => requireBookableWhenActive(deps, scope, { draft, serviceId: service.id }))
    .andThen((draft) => deps.services.update(service.id, actor.tenantId, draft));
}
