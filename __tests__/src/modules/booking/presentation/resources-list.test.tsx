import { fireEvent, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { ResourcesList } from '@modules/booking/presentation/components/resources/resources-list';
import type { ResourcePageDto } from '@modules/booking/presentation/dto/resource-dto';
import type { ResourceListView } from '@modules/booking/presentation/forms/resource-list-href';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const room = {
  id: 'r-1',
  name: 'Besprechungsraum 1',
  type: 'meeting-room',
  places: 4,
  status: 'active',
  usedBy: [
    { serviceId: 's-1', serviceName: 'Wohnsitz anmelden', isRequired: false },
    { serviceId: 's-2', serviceName: 'Beratung Ausweise', isRequired: true },
  ],
  today: {
    timeZone: 'Europe/Berlin',
    window: { start: '2027-01-11T08:00:00+01:00', end: '2027-01-11T18:00:00+01:00' },
    busy: [{ start: '2027-01-11T10:30:00+01:00', end: '2027-01-11T11:00:00+01:00', isFull: true }],
    peak: 4,
  },
} as const;

function page(items: ResourcePageDto['items']): ResourcePageDto {
  return {
    location: { id: 'loc-1', name: 'Bürgerbüro Mitte' },
    items,
    page: 1,
    pageSize: 10,
    total: items.length,
    pageCount: 1,
  };
}

const VIEW: ResourceListView = { search: undefined, type: undefined, pageSize: 10 };

async function renderList(items: ResourcePageDto['items'], view = VIEW) {
  return renderServer(
    await ResourcesList({
      locale: 'en',
      websiteId: 'site',
      page: page(items),
      view,
      mayConfigure: true,
    }),
  );
}

describe('the resources of a location', () => {
  it('opens a row to show today’s use and who uses it, in words and not by colour alone', async () => {
    const { container } = await renderList([room]);

    const row = screen.getByText('Besprechungsraum 1').closest('tr');
    expect(row).toHaveTextContent('Meeting room');
    const trigger = screen.getByRole('button', { name: 'Besprechungsraum 1' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText(/Peak 4 of 4/)).toBeInTheDocument();
    expect(screen.getAllByText(/Fully booked/).length).toBeGreaterThan(0);
    expect(screen.getByText('Wohnsitz anmelden (optional)')).toBeInTheDocument();
    expect(screen.getByText('Shared: capacity counts across all services.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open: Besprechungsraum 1' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-1/resources/r-1?list=page%3D1%26pageSize%3D10',
    );
    await expectNoViolations(container);
  });

  it('tells a filter that found nothing apart from a location with nothing yet', async () => {
    await renderList([], { ...VIEW, search: 'drucker' });
    expect(screen.getByText('No resources found')).toBeInTheDocument();
  });

  it('offers to add the first resource', async () => {
    await renderList([]);
    expect(screen.getByRole('link', { name: 'Add resource' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-1/resources/new',
    );
  });
});
