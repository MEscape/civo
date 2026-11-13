import { initialJourney } from './journey-state';
import { monthOf, monthSpan } from './month-calendar';

import type { BookingCatalogDto } from '../dto/catalog-dto';

/**
 * Where the calendar opens when the journey starts at it (one service at one place): the month of
 * the location's today, and the free starts to ask for. `null` when the visitor chooses first.
 */
export function initialMonthOf(catalog: BookingCatalogDto) {
  const { step, serviceId, locationId } = initialJourney(catalog);
  const today = catalog.locations.find((location) => location.id === locationId)?.today;
  if (step !== 'date' || serviceId === null || locationId === null || today === undefined) {
    return null;
  }
  const month = monthOf(today);
  const span = monthSpan(month, today);
  return span === null ? null : { month, request: { serviceId, locationId, ...span } };
}
