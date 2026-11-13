import { evaluateBookable } from '../../domain/policies/service-policy';
import { formatLocalDate } from '../../domain/time/local-date';
import { localDateOf } from '../../domain/time/time-zone';

import type { ChangePolicy } from '../../domain/models/bookable-service';
import type { BookingCatalog, CatalogEntry } from '../../domain/ports/booking-catalog.repository';
import type { Instant } from '../../domain/time/instant';
import type { GetBookingCatalogInput } from '../contracts/booking-inputs';
import type {
  BookingCatalogView,
  CatalogChangeRuleView,
  CatalogServiceView,
} from '../contracts/catalog-views';

/** A category as the editor may have typed it: case and surrounding spaces do not count. */
const asKey = (text: string) => text.trim().toLowerCase();

const ruleOf = (policy: ChangePolicy): CatalogChangeRuleView => ({
  isAllowed: policy.isAllowed && policy.allowedActors.includes('customer'),
  deadlineMinutes: policy.deadlineMinutes,
});

/** Whether the editor's narrowing keeps the entry: one service by id, or one category by name. */
function isChosen({ service, category }: CatalogEntry, input: GetBookingCatalogInput): boolean {
  if (input.serviceId !== undefined && input.serviceId !== String(service.id)) {
    return false;
  }
  return (
    input.category === undefined || (category !== null && asKey(category) === asKey(input.category))
  );
}

/**
 * The catalog a visitor sees: each chosen service with the active locations at which the domain
 * lets a visitor book it (`evaluateBookable`, the rule a hold applies), services offered nowhere
 * left out, and only the locations some service is offered at.
 */
export function toCatalogView(
  { entries, locations, isTruncated }: BookingCatalog,
  input: GetBookingCatalogInput,
  now: Instant,
): BookingCatalogView {
  const services = entries
    .filter((entry) => isChosen(entry, input))
    .map(({ service, ...texts }): CatalogServiceView => ({
      id: service.id,
      name: service.name,
      ...texts,
      durationMinutes: service.rules.durationMinutes,
      horizonDays: service.horizonDays,
      information: service.information,
      cancellation: ruleOf(service.cancellation),
      rescheduling: ruleOf(service.rescheduling),
      locationIds: locations
        .filter((location) => evaluateBookable(service, location.id, 'online') === null)
        .map((location) => location.id),
    }))
    .filter((service) => service.locationIds.length > 0);
  const offered = new Set(services.flatMap((service) => service.locationIds));
  return {
    services,
    isTruncated,
    locations: locations
      .filter((location) => offered.has(location.id))
      .map((location) => ({
        id: location.id,
        name: location.name,
        address: location.address,
        timeZone: location.zone,
        today: formatLocalDate(localDateOf(now, location.zone)),
      })),
  };
}
