import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { BookingScope } from './booking.repository';
import type { BookableService } from '../models/bookable-service';
import type { BookableServiceId } from '../models/ids';

/**
 * Read-only access to the services of a website, reduced to what the booking rules read. Creating
 * and editing them belongs to the administration (later steps). Answers `null` for a service of
 * another website, exactly as for one that does not exist.
 */
export interface BookableServiceRepository {
  findById(
    scope: BookingScope,
    id: BookableServiceId,
  ): AppResultAsync<BookableService | null, InfrastructureAppError>;
}
