import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isFiniteNumber, isString, objectOf } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';

import { readRequirements } from './bookable-service-record-mapper';

import type { ServiceSnapshot } from '../../domain/models/service-snapshot';

interface StoredSnapshot {
  readonly serviceName: string;
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  readonly requirements: unknown;
}

const isSnapshot = objectOf<StoredSnapshot>({
  serviceName: isString,
  durationMinutes: isFiniteNumber,
  preparationMinutes: isFiniteNumber,
  cleanupMinutes: isFiniteNumber,
  requirements: (value): value is unknown => value !== undefined,
});

/** The snapshot a booking was made with; `null` for a booking made before they were kept. */
export function readSnapshot(
  raw: unknown,
): AppResult<ServiceSnapshot | null, InfrastructureAppError> {
  if (raw === null || raw === undefined) {
    return ok(null);
  }
  if (!isSnapshot(raw)) {
    return err(bookingDataInvalid('service snapshot'));
  }
  const requirements = readRequirements(raw.requirements);
  return requirements === null
    ? err(bookingDataInvalid('service snapshot requirements'))
    : ok({
        serviceName: raw.serviceName,
        durationMinutes: raw.durationMinutes,
        preparationMinutes: raw.preparationMinutes,
        cleanupMinutes: raw.cleanupMinutes,
        requirements,
      });
}
