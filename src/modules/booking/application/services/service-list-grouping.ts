import { clampToLastPage, offsetOf, pageCountOf, resolvePageRequest } from '@lib/pagination';
import { groupBy, isDefined, unique } from '@lib/utils';

import { originAt } from '../../domain/models/service-origin';
import { SERVICE_PAGE_LIMITS } from '../booking-limits';
import { SERVICE_ORIGINS, SERVICE_LIMITS } from '../contracts/booking-constraints';

import { toServiceSummary } from './service-views';

import type { LocationNames } from './service-names';
import type { BookingLocationId } from '../../domain/models/ids';
import type { ServiceListEntry } from '../../domain/ports/service-admin.repository';
import type { ServiceOriginKind } from '../contracts/booking-constraints';
import type { ListServicesInput } from '../contracts/service-inputs';
import type {
  ServiceGroupView,
  ServicePageView,
  ServiceSummaryView,
} from '../contracts/service-views';

/** What a list of services is narrowed to; a value that is not one of the choices means "no filter". */
export interface ServiceFilters {
  readonly search: string | null;
  readonly category: string | null;
  readonly origin: ServiceOriginKind | null;
  readonly status: 'active' | 'inactive' | null;
}

export function readFilters(input: ListServicesInput): ServiceFilters {
  const search = input.search?.trim().slice(0, SERVICE_LIMITS.searchMax) ?? '';
  const category = input.category?.trim() ?? '';
  return {
    search: search === '' ? null : search.toLowerCase(),
    category: category === '' ? null : category,
    origin: SERVICE_ORIGINS.find((origin) => origin === input.origin) ?? null,
    status: input.status === 'active' || input.status === 'inactive' ? input.status : null,
  };
}

/** Whether one service passes the filters, as it is seen from the location. */
function passes(
  entry: ServiceListEntry,
  locationId: BookingLocationId,
  filters: ServiceFilters,
): boolean {
  const isActive = entry.isActive && entry.setting.isActive;
  return (
    (filters.search === null || entry.name.toLowerCase().includes(filters.search)) &&
    (filters.category === null || entry.category === filters.category) &&
    (filters.origin === null || originAt(entry, locationId).kind === filters.origin) &&
    (filters.status === null || isActive === (filters.status === 'active'))
  );
}

/** Categories by name, services without one last; services by name inside a category. */
function byCategory(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  return b === null ? -1 : a.localeCompare(b);
}

function groupByCategory(summaries: readonly ServiceSummaryView[]): ServiceGroupView[] {
  return [...groupBy(summaries, (summary) => summary.category)]
    .sort(([a], [b]) => byCategory(a, b))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/**
 * The page of a location's services: filtered, grouped by category, and paged by category so a
 * category is never split over two pages. The location's services are bounded when they are read, so
 * this works on what is in hand and says when it was cut.
 */
export function pageOfServices(request: {
  readonly location: { readonly id: BookingLocationId; readonly name: string };
  readonly entries: readonly ServiceListEntry[];
  readonly isTruncated: boolean;
  readonly filters: ServiceFilters;
  readonly names: LocationNames;
  readonly input: ListServicesInput;
}): ServicePageView {
  const { location, entries, isTruncated, filters, names, input } = request;
  const groups = groupByCategory(
    entries
      .filter((entry) => passes(entry, location.id, filters))
      .map((entry) => toServiceSummary(entry, location.id, names)),
  );
  const wanted = resolvePageRequest(input.page, SERVICE_PAGE_LIMITS);
  const paging = clampToLastPage(wanted, groups.length);
  const start = offsetOf(paging);
  return {
    location: { id: location.id, name: location.name },
    groups: groups.slice(start, start + paging.pageSize),
    page: paging.page,
    pageSize: paging.pageSize,
    total: groups.length,
    pageCount: pageCountOf(groups.length, paging.pageSize),
    serviceCount: groups.reduce((sum, group) => sum + group.items.length, 0),
    categories: [...unique(entries.map((entry) => entry.category).filter(isDefined))].sort((a, b) =>
      a.localeCompare(b),
    ),
    isTruncated,
  };
}
