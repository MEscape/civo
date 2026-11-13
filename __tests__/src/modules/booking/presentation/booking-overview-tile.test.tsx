import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingOverviewTile } from '@modules/booking/presentation/components/shared/booking-overview-tile';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { renderServer } from '../support/server-render';

const mocks = vi.hoisted(() => ({ setup: vi.fn() }));

vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' }),
  getAppFormatters: async () => ({ number: (value: number) => String(value) }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@modules/booking/composition', () => ({
  getBookingQueries: () => ({ getBookingSetup: { execute: mocks.setup } }),
}));
vi.mock('@lib/errors/or-null', () => ({
  orNull: async (result: Promise<{ ok: boolean; value: unknown }>) => {
    const settled = await result;
    return settled.ok ? settled.value : null;
  },
}));

const FULL = { locations: 1, services: 3, resources: 2, team: 1 };
const answer = (value: unknown) => {
  mocks.setup.mockResolvedValue({ ok: true, value });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the booking tile of the website overview', () => {
  it('shows nothing for someone who may not read bookings', async () => {
    mocks.setup.mockResolvedValue({ ok: false, value: null });
    const tile = await BookingOverviewTile({ locale: 'en', websiteId: 'site' });

    expect(tile).toBeNull();
  });

  it('shows the figures and no hint once locations, services, resources and a team exist', async () => {
    answer(FULL);
    await renderServer(await BookingOverviewTile({ locale: 'en', websiteId: 'site' }));

    expect(screen.getByText('3 Services · 2 Resources · 1 Team')).toBeInTheDocument();
    expect(screen.queryByText(enBooking.booking.websiteOverview.finish)).toBeNull();
  });

  it.each(['locations', 'services', 'resources', 'team'] as const)(
    'asks to finish the setup while there is no %s, like the guide in the booking area',
    async (missing) => {
      answer({ ...FULL, [missing]: 0 });
      await renderServer(await BookingOverviewTile({ locale: 'en', websiteId: 'site' }));

      expect(screen.getByText(enBooking.booking.websiteOverview.finish)).toBeInTheDocument();
    },
  );
});
