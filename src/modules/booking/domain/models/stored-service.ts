import type { BookableService } from './bookable-service';
import type { BookingLocationId } from './ids';
import type { ServiceLocationSetting } from './service-location';
import type { Instant } from '../time/instant';

/** A service switched on at one location, with the version a change to that part must name. */
export interface StoredServiceLocation extends ServiceLocationSetting {
  /** When this part last changed: a change to it names this and is refused if it moved on. */
  readonly updatedAt: Instant;
}

/**
 * A service as the administration reads and writes it: what the booking rules read, plus what the
 * manager describes (the text a citizen sees, the documents to bring) and what is only for
 * managers. `updatedAt` is the version of the shared definition; each location's part has its own.
 * `internalNote` never leaves the administration.
 */
export interface StoredService extends BookableService {
  readonly description: string | null;
  readonly category: string | null;
  readonly requiredDocuments: readonly string[];
  readonly instructions: string | null;
  readonly internalNote: string | null;
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
  /** Where it was created: it reads "own" there and "linked" everywhere else. `null`: made before it was kept. */
  readonly homeLocationId: BookingLocationId | null;
  /** The location a copy was taken from. Display only. */
  readonly copiedFromLocationId: BookingLocationId | null;
  readonly locations: readonly StoredServiceLocation[];
  readonly updatedAt: Instant;
}

/** A service about to be stored: the repository gives it its id and first version. */
export type NewService = Omit<StoredService, 'id' | 'updatedAt' | 'locations'>;
