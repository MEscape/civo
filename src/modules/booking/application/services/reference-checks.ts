import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { MAX_LOCATIONS_PER_WEBSITE, MAX_RESOURCES_PER_WEBSITE } from '../booking-limits';

import type { BookableResourceDraft } from '../../domain/models/bookable-resource';
import type { BookableServiceDraft } from '../../domain/models/bookable-service';
import type { WebsiteId } from '../../domain/models/ids';
import type { BookingDependencies } from '../booking-dependencies';

type ReferenceDependencies = Pick<BookingDependencies, 'locations' | 'resources'>;

export type ReferenceCheckError = ValidationAppError | InfrastructureAppError;

function allKnown(ids: readonly string[], known: ReadonlySet<string>): boolean {
  return ids.every((id) => known.has(id));
}

/** The website a draft belongs to, and the tenant that owns it. */
export interface ReferenceScope {
  readonly tenantId: TenantId;
  readonly websiteId: WebsiteId;
}

/**
 * Locations and resources a draft names must exist in the same website.
 * (The store holds them as plain id lists, so this is where that integrity is
 * enforced; the website is the boundary, and ids from another tenant simply
 * do not appear in the lists loaded for this one.)
 */
export function checkLocationReference(
  deps: ReferenceDependencies,
  { tenantId, websiteId }: ReferenceScope,
  draft: BookableResourceDraft,
): AppResultAsync<BookableResourceDraft, ReferenceCheckError> {
  if (draft.locationId === null) {
    return okAsync(draft);
  }
  const wanted = draft.locationId;
  return deps.locations
    .listByWebsite(websiteId, tenantId, MAX_LOCATIONS_PER_WEBSITE)
    .andThen((locations) =>
      locations.some((location) => location.id === wanted)
        ? okAsync(draft)
        : errAsync(fieldValidationFailed('locationId', BOOKING_VALIDATION_CODES.idInvalid)),
    );
}

function checkServiceReferences(
  draft: BookableServiceDraft,
  locationIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
): AppResult<BookableServiceDraft, ValidationAppError> {
  if (!allKnown(draft.locationIds, locationIds)) {
    return err(fieldValidationFailed('locationIds', BOOKING_VALIDATION_CODES.idInvalid));
  }
  const named = draft.requirements.flatMap((requirement) => requirement.resourceIds ?? []);
  if (!allKnown(named, resourceIds)) {
    return err(fieldValidationFailed('requirements', BOOKING_VALIDATION_CODES.idInvalid));
  }
  return ok(draft);
}

export function checkServiceReference(
  deps: ReferenceDependencies,
  { tenantId, websiteId }: ReferenceScope,
  draft: BookableServiceDraft,
): AppResultAsync<BookableServiceDraft, ReferenceCheckError> {
  return deps.locations
    .listByWebsite(websiteId, tenantId, MAX_LOCATIONS_PER_WEBSITE)
    .andThen((locations) =>
      deps.resources
        .listByWebsite(websiteId, tenantId, MAX_RESOURCES_PER_WEBSITE)
        .andThen((resources) =>
          checkServiceReferences(
            draft,
            new Set(locations.map((location) => location.id)),
            new Set(resources.map((resource) => resource.id)),
          ).asyncAndThen((checked) => okAsync(checked)),
        ),
    );
}
