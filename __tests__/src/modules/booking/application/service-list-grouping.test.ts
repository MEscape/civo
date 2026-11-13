import { describe, expect, it } from 'vitest';

import type { ListServicesInput } from '@modules/booking/application/contracts/service-inputs';
import {
  pageOfServices,
  readFilters,
} from '@modules/booking/application/services/service-list-grouping';
import { toBookableServiceId, toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { ServiceListEntry } from '@modules/booking/domain/ports/service-admin.repository';

const WEST = toBookingLocationId('west');
const EAST = toBookingLocationId('east');
const NAMES = new Map([
  ['west', 'West'],
  ['east', 'East'],
]);

const entry = (name: string, overrides: Partial<ServiceListEntry> = {}): ServiceListEntry => ({
  id: toBookableServiceId(name),
  name,
  category: null,
  durationMinutes: 20,
  isActive: true,
  homeLocationId: WEST,
  copiedFromLocationId: null,
  setting: { isActive: true, isOnlineBookable: true },
  ...overrides,
});

const page = (entries: ServiceListEntry[], filters: Partial<ListServicesInput> = {}) => {
  const input: ListServicesInput = {
    websiteId: 'tenant-1',
    locationId: 'west',
    page: {},
    ...filters,
  };
  return pageOfServices({
    location: { id: WEST, name: 'West' },
    entries,
    isTruncated: false,
    filters: readFilters(input),
    names: NAMES,
    input,
  });
};

describe('the list of services of a location', () => {
  const entries = [
    entry('Zeta', { category: 'B' }),
    entry('Alpha', { category: 'B' }),
    entry('Loose'),
    entry('Gamma', { category: 'A' }),
    entry('Off', { category: 'A', setting: { isActive: false, isOnlineBookable: true } }),
    entry('Linked', { category: 'A', homeLocationId: EAST }),
  ];

  it('groups by category, services without one last, by name inside', () => {
    const { groups, serviceCount } = page(entries);

    expect(groups.map((group) => [group.category, group.items.map((item) => item.name)])).toEqual([
      ['A', ['Gamma', 'Linked', 'Off']],
      ['B', ['Alpha', 'Zeta']],
      [null, ['Loose']],
    ]);
    expect(serviceCount).toBe(6);
  });

  it('filters by name, category, origin and status, and ignores a value that is not a choice', () => {
    const names = (filters: Partial<ListServicesInput>) =>
      page(entries, filters).groups.flatMap((group) => group.items.map((item) => item.name));

    expect(names({ search: ' ALP ' })).toEqual(['Alpha']);
    expect(names({ category: 'A' })).toEqual(['Gamma', 'Linked', 'Off']);
    expect(names({ origin: 'linked' })).toEqual(['Linked']);
    expect(names({ status: 'inactive' })).toEqual(['Off']);
    expect(names({ status: 'nonsense' })).toHaveLength(6);
  });

  it('lists the categories of everything, not only of what passed the filter', () => {
    expect(page(entries, { search: 'Loose' }).categories).toEqual(['A', 'B']);
  });

  it('pages by category, never splitting one, and clamps a page past the end', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      entry(`s${index}`, { category: `C${String(index).padStart(2, '0')}` }),
    );

    const last = page(many, { page: { page: 999 } });

    expect(last.page).toBe(last.pageCount);
    expect(last.total).toBe(40);
    expect(last.groups.every((group) => group.items.length === 1)).toBe(true);
  });
});
