import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocationOverviewMap } from '@modules/booking/presentation/components/locations/location-overview-map.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

const mocks = vi.hoisted(() => ({ geocode: vi.fn() }));

vi.mock('@hooks/use-geocoded-places', () => ({ useGeocodedPlaces: mocks.geocode }));
vi.mock('@components/shared/point-map', () => ({ PointMap: () => null }));

const overviewMap = (address: string | null) => (
  <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
    <LocationOverviewMap
      tiles={{ accessToken: 'test-token', styleUrl: 'mapbox://styles/test' }}
      id="location"
      name="Town hall"
      address={address}
    />
  </NextIntlClientProvider>
);

beforeEach(() => {
  mocks.geocode.mockReset();
  mocks.geocode.mockReturnValue({ places: {}, isSettled: false });
});

describe('LocationOverviewMap', () => {
  it('reports an unfound address only after the lookup settles', () => {
    const { rerender } = render(overviewMap('Market 1'));

    expect(screen.getByRole('group', { name: 'Location on the map' })).toBeInTheDocument();
    expect(screen.queryByText(enBooking.booking.overview.mapNotFound)).not.toBeInTheDocument();
    expect(screen.queryByText(enBooking.booking.overview.mapNoAddress)).not.toBeInTheDocument();

    mocks.geocode.mockReturnValue({ places: {}, isSettled: true });
    rerender(overviewMap('Market 1'));

    expect(screen.getByText(enBooking.booking.overview.mapNotFound)).toBeInTheDocument();
  });

  it('explains a missing address immediately without waiting for geocoding', () => {
    render(overviewMap(null));

    expect(screen.getByText(enBooking.booking.overview.mapNoAddress)).toBeInTheDocument();
    expect(screen.queryByText(enBooking.booking.overview.mapNotFound)).not.toBeInTheDocument();
  });

  it('keeps empty-place messages absent when the address resolves to a place', () => {
    mocks.geocode.mockReturnValue({
      places: { location: { lng: 13.4, lat: 52.5 } },
      isSettled: true,
    });
    render(overviewMap('Market 1'));

    expect(screen.queryByText(enBooking.booking.overview.mapNotFound)).not.toBeInTheDocument();
    expect(screen.queryByText(enBooking.booking.overview.mapNoAddress)).not.toBeInTheDocument();
  });
});
