import { describe, expect, it } from 'vitest';

import { locationListNavigation } from '@modules/booking/presentation/forms/location-list-navigation';

describe('location list context', () => {
  it('normalizes the first repeated origin and first repeated filter value', () => {
    const origin = locationListNavigation.parse(['q=hall&q=other&page=3&pageSize=10', 'q=ignored']);
    expect(locationListNavigation.parent('site', origin)).toBe(
      '/bookings/site/locations?q=hall&page=3&pageSize=10',
    );
  });

  it('retains a filtered list slice through detail, edit and the parent destination', () => {
    const origin = locationListNavigation.originOf({
      search: 'city hall',
      status: 'inactive',
      page: 3,
      pageSize: 10,
    });
    const detail = locationListNavigation.withOrigin('/locations/office', origin);
    const carried = new URLSearchParams(detail.split('?')[1]).get('list') ?? undefined;
    const normalized = locationListNavigation.parse(carried);
    const editor = locationListNavigation.withOrigin(
      '/locations/office/edit?section=hours',
      normalized,
    );

    expect(editor).toContain('section=hours&list=');
    expect(locationListNavigation.parent('site', normalized)).toBe(
      '/bookings/site/locations?q=city+hall&status=inactive&page=3&pageSize=10',
    );
  });

  it('drops unrecognized values, bounds pagination and never accepts a return destination', () => {
    const origin = locationListNavigation.parse(
      'q=office&status=broken&page=-1&pageSize=999&returnTo=https://evil.test',
    );
    expect(locationListNavigation.parent('site', origin)).toBe(
      '/bookings/site/locations?q=office&page=1&pageSize=100',
    );
    expect(locationListNavigation.parent('site', 'https://evil.test/path')).toBe(
      '/bookings/site/locations?page=1&pageSize=25',
    );
    expect(locationListNavigation.parent('site', undefined)).toBe('/bookings/site/locations');
    expect(locationListNavigation.withOrigin('/locations/office', undefined)).toBe(
      '/locations/office',
    );
  });
});
