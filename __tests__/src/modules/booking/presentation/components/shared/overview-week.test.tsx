import type { ReactNode } from 'react';

import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { BookingDto } from '@modules/booking/client';
import { OverviewWeek } from '@modules/booking/presentation/components/shared/overview-week';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { createAppFormatters } from '@i18n/formatters/app-formatters';

import { renderServer } from '../../../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' }),
  getAppFormatters: async () => createAppFormatters('en', 'Europe/Berlin'),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BOOKING: BookingDto = {
  websiteId: 'site',
  id: 'covered',
  reference: '7KQ2M9XB4C',
  status: 'confirmed',
  serviceId: 'service',
  locationId: 'location',
  timeZone: 'Europe/Berlin',
  start: '2027-01-10T09:00:00+01:00',
  end: '2027-01-10T09:30:00+01:00',
  units: [{ requirementIndex: 0, resourceType: 'employee', resourceId: 'employee' }],
  assignment: 'assigned',
  customer: null,
  holdExpiresAt: null,
  rescheduleCount: 0,
  cancelledAt: null,
  createdAt: '2027-01-01T09:00:00+01:00',
};

describe('OverviewWeek', () => {
  it('preserves a named semantic table for all seven days and the chart totals', async () => {
    await renderServer(
      <OverviewWeek
        locale="en"
        websiteId="site"
        from="2027-01-10"
        items={[
          BOOKING,
          {
            ...BOOKING,
            id: 'waiting',
            assignment: 'open',
            units: [{ requirementIndex: 0, resourceType: 'employee', resourceId: null }],
          },
          {
            ...BOOKING,
            id: 'tomorrow',
            start: '2027-01-11T09:00:00+01:00',
            end: '2027-01-11T09:30:00+01:00',
          },
          { ...BOOKING, id: 'cancelled', status: 'cancelled' },
        ]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Bookings per day, next 7 days' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Day', 'Covered by an employee', 'Waiting for an employee']);
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => [
          within(row).getByRole('rowheader').textContent,
          ...within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ]),
    ).toEqual([
      ['Jan 10, 2027', '1', '1'],
      ['Jan 11, 2027', '1', '0'],
      ['Jan 12, 2027', '0', '0'],
      ['Jan 13, 2027', '0', '0'],
      ['Jan 14, 2027', '0', '0'],
      ['Jan 15, 2027', '0', '0'],
      ['Jan 16, 2027', '0', '0'],
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['3', '1']);
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute(
      'href',
      '/bookings/site/calendar',
    );
    expect(screen.queryByText('No bookings in the next 7 days')).not.toBeInTheDocument();
  });

  it.each([
    { from: '2027-01-10', items: [] },
    { from: null, items: null },
  ])(
    'shows the intentional empty state without a table when the week starts at $from',
    async (week) => {
      await renderServer(<OverviewWeek locale="en" websiteId="site" {...week} />);

      expect(screen.getByText('No bookings in the next 7 days')).toBeInTheDocument();
      expect(screen.getByText('They appear here as soon as they are made.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
        '0',
        '0',
      ]);
    },
  );
});
