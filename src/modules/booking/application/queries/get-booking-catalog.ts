import type { AppResultAsync } from '@lib/result';

import { MAX_CATALOG_ENTRIES } from '../booking-limits';
import { BOOKING_RATE_LIMITS } from '../rate-limits';
import { toCatalogView } from '../services/catalog-views';
import { currentInstant } from '../services/clock-instant';
import { resolveScopeWithinBudget } from '../services/limit-visitor';

import type { CatalogDependencies } from '../booking-dependencies';
import type { GetBookingCatalogInput } from '../contracts/booking-inputs';
import type { BookingCatalogView } from '../contracts/catalog-views';
import type { VisitorLimitError } from '../services/limit-visitor';
import type { PublicScopeError } from '../services/public-scope';

export type GetBookingCatalogError = PublicScopeError | VisitorLimitError;

/**
 * What a visitor can book on a website: every service that is switched on and takes online
 * bookings at an active location, with the places that offer it, narrowed to the service or the
 * category the page was set up with. The same rule as a hold (`evaluateBookable`), so nothing is
 * offered that a hold would refuse.
 *
 * @authorization public Anyone may see what a municipality offers online; the answer names services and places, never staff, resources or bookings.
 */
export class GetBookingCatalog {
  constructor(private readonly deps: CatalogDependencies) {}

  execute(
    input: GetBookingCatalogInput,
  ): AppResultAsync<BookingCatalogView, GetBookingCatalogError> {
    return resolveScopeWithinBudget(
      this.deps,
      BOOKING_RATE_LIMITS.searchClient,
      input.websiteId,
    ).andThen((scope) =>
      this.deps.catalog
        .findCatalog(scope, MAX_CATALOG_ENTRIES)
        .map((catalog) => toCatalogView(catalog, input, currentInstant(this.deps.clock))),
    );
  }
}
