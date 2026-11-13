import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingLocationFacts } from './booking-location.repository';
import type { BookingScope } from './booking.repository';
import type { BookableService } from '../models/bookable-service';

/** A service as a visitor reads it before booking: the rules, and the texts that describe it. */
export interface CatalogEntry {
  /** The service as the rules read it; its locations carry no resources (a visitor never sees them). */
  readonly service: BookableService;
  readonly description: string | null;
  readonly category: string | null;
  readonly instructions: string | null;
  readonly requiredDocuments: readonly string[];
}

/** The active services and active locations of a website, each list bounded. */
export interface BookingCatalog {
  readonly entries: readonly CatalogEntry[];
  readonly locations: readonly BookingLocationFacts[];
  /** The website has more services or locations than one answer carries. */
  readonly isTruncated: boolean;
}

/**
 * What the public booking page offers. Which service is bookable where is the domain's rule
 * (`evaluateBookable`); this only reads the candidates, scoped to the website.
 */
export interface BookingCatalogRepository {
  // @truncation none the returned BookingCatalog carries `isTruncated` for both lists
  /** At most `limit` services and `limit` locations, by name. */
  findCatalog(
    scope: BookingScope,
    limit: number,
  ): AppResultAsync<BookingCatalog, InfrastructureAppError>;
}
