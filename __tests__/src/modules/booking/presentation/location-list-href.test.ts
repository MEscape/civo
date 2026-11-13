import { describe, expect, it } from 'vitest';

import { locationListHref } from '@modules/booking/presentation/forms/location-list-href';

const BASE = '/de/bookings/site/locations';

describe('the address of the locations list', () => {
  it('keeps the search and the page size when the status or the page changes', () => {
    const view = { search: 'mitte', status: 'active', pageSize: 25 } as const;

    expect(locationListHref(BASE, view, { status: 'inactive' })).toBe(
      `${BASE}?q=mitte&status=inactive&pageSize=25`,
    );
    expect(locationListHref(BASE, view, { page: 3 })).toBe(
      `${BASE}?q=mitte&status=active&page=3&pageSize=25`,
    );
  });

  it('leaves out what is the default: all states, no search', () => {
    expect(
      locationListHref(
        BASE,
        { search: undefined, status: 'inactive', pageSize: 10 },
        { status: 'all' },
      ),
    ).toBe(`${BASE}?pageSize=10`);
  });
});
