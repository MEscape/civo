import type { ReactNode } from 'react';

import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { LocationDto } from '@modules/booking/client';
import { LocationCard } from '@modules/booking/presentation/components/locations/location-card';
import { LocationOverview } from '@modules/booking/presentation/components/locations/location-overview';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { officeWeek } from '../support/location-inputs';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ORIGIN = 'q=hall&status=active&page=3&pageSize=10';
const LOCATION: LocationDto = {
  websiteId: 'site',
  id: 'office',
  name: 'City hall',
  address: null,
  timeZone: 'Europe/Berlin',
  isActive: true,
  weekly: officeWeek(),
  exceptions: [],
  version: '2027-01-10T11:00:00.000Z',
  futureBookingCount: 0,
};

describe('location navigation', () => {
  it('carries the list context when opening a location', async () => {
    await renderServer(
      <ul>
        <LocationCard
          locale="en"
          websiteId="site"
          location={{ ...LOCATION, todayWindows: [] }}
          listOrigin={ORIGIN}
        />
      </ul>,
    );

    const href = screen.getByRole('link', { name: 'City hall' }).getAttribute('href');
    expect(new URLSearchParams(href?.split('?')[1]).get('list')).toBe(ORIGIN);
  });

  it('carries the same list context into every independently editable section', async () => {
    await renderServer(
      <LocationOverview
        locale="en"
        location={LOCATION}
        mayConfigure
        isSaved={false}
        listOrigin={ORIGIN}
        tiles={null}
      />,
    );

    const links = screen.getAllByRole('link', { name: /^Edit:/ });
    expect(links).toHaveLength(3);
    expect(
      links.map((link) =>
        new URLSearchParams(link.getAttribute('href')?.split('?')[1]).get('list'),
      ),
    ).toEqual([ORIGIN, ORIGIN, ORIGIN]);
  });
});
