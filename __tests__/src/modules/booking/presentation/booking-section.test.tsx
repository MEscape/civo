import type { ReactNode } from 'react';

import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingCatalogDto } from '@modules/booking/client';
import { BookingSection } from '@modules/booking/presentation/components/public/booking-section';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), slots: vi.fn() }));

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@components/providers/i18n-provider', () => ({
  I18nProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@modules/booking/composition', () => ({
  getBookingQueries: () => ({
    getBookingCatalog: { execute: mocks.catalog },
    getAvailableSlots: { execute: mocks.slots },
  }),
}));

const ONE_PLACE: BookingCatalogDto = {
  isTruncated: false,
  services: [
    {
      id: 'svc-pass',
      name: 'Passport',
      description: null,
      category: null,
      instructions: null,
      requiredDocuments: [],
      durationMinutes: 30,
      horizonDays: 30,
      information: [{ field: 'email', isRequired: true }],
      cancellation: { isAllowed: true, deadlineMinutes: 60 },
      rescheduling: { isAllowed: true, deadlineMinutes: 60 },
      locationIds: ['loc-west'],
    },
  ],
  locations: [
    {
      id: 'loc-west',
      name: 'Town hall West',
      address: null,
      timeZone: 'Europe/Berlin',
      today: '2027-01-28',
    },
  ],
};

const section = (renderMode: 'published' | 'draft') => (
  <BookingSection websiteId="site" renderMode={renderMode} heading="Book" category="Passes" />
);

beforeEach(() => {
  mocks.catalog.mockReset();
  mocks.slots.mockReset();
});

describe('BookingSection', () => {
  it('reads nothing in the editor and says what the published page will hold', async () => {
    await renderServer(
      await BookingSection({ websiteId: 'site', renderMode: 'draft', heading: 'Book' }),
    );

    expect(screen.getByText('Online appointment booking')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mocks.catalog).not.toHaveBeenCalled();
  });

  it('asks for the catalog of the page’s website, narrowed as the editor set it up', async () => {
    mocks.catalog.mockReturnValue(errAsync(forbiddenError('rate_limit.exceeded', 'Slow down.')));
    await renderServer(section('published'));

    expect(mocks.catalog).toHaveBeenCalledWith({
      websiteId: 'site',
      serviceId: undefined,
      category: 'Passes',
    });
    expect(screen.getByText('Booking cannot be loaded right now')).toBeInTheDocument();
  });

  it('opens at the calendar with the free days already read when there is nothing to choose', async () => {
    mocks.catalog.mockReturnValue(okAsync(ONE_PLACE));
    mocks.slots.mockReturnValue(
      okAsync({
        timeZone: 'Europe/Berlin',
        slots: [{ start: '2027-01-29T09:00:00+01:00', end: '2027-01-29T09:30:00+01:00' }],
        isTruncated: false,
      }),
    );
    const { container } = await renderServer(section('published'));

    expect(mocks.slots).toHaveBeenCalledWith({
      websiteId: 'site',
      serviceId: 'svc-pass',
      locationId: 'loc-west',
      from: '2027-01-28',
      to: '2027-01-31',
    });
    expect(screen.getByRole('heading', { name: 'On which day?' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /January 29, 2027, appointments free/ }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: /January 30, 2027, nothing free/ })).toBeDisabled();
    await expectNoViolations(container);
  });
});
