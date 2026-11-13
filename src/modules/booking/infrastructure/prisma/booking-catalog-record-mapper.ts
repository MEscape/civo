import type { InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { arrayOf, isString } from '@lib/utils';

import { bookingDataInvalid } from '../../domain/errors/booking-errors';

import { SERVICE_SELECT, toService } from './bookable-service-record-mapper';
import { readSettings } from './service-location-record-mapper';

import type { ServiceRecord } from './bookable-service-record-mapper';
import type { ServiceLocationRecord } from './service-location-record-mapper';
import type { CatalogEntry } from '../../domain/ports/booking-catalog.repository';

/** A service row as the catalog reads it: the rules, the texts a visitor reads, where it runs. */
export interface CatalogRecord extends ServiceRecord {
  readonly description: string | null;
  readonly category: string | null;
  readonly instructions: string | null;
  readonly requiredDocuments: unknown;
  readonly locations: readonly ServiceLocationRecord[];
}

export const CATALOG_SERVICE_SELECT = [
  ...SERVICE_SELECT,
  'description',
  'category',
  'instructions',
  'requiredDocuments',
] as const satisfies ReadonlyArray<keyof Omit<CatalogRecord, 'locations'>>;

const isTextList = arrayOf(isString);
const NO_RESOURCE_TYPES = new Map<string, never>();

/** A catalog entry, or a persistence failure for a row in a shape the writes never make. */
export function toCatalogEntry(
  record: CatalogRecord,
): AppResult<CatalogEntry, InfrastructureAppError> {
  const { requiredDocuments } = record;
  if (!isTextList(requiredDocuments)) {
    return err(bookingDataInvalid('documents'));
  }
  // The visitor's catalog never reads resources: without their types the links are left out.
  return readSettings(record.locations, NO_RESOURCE_TYPES)
    .andThen((settings) => toService(record, settings))
    .andThen((service) =>
      ok({
        service,
        description: record.description,
        category: record.category,
        instructions: record.instructions,
        requiredDocuments,
      }),
    );
}
