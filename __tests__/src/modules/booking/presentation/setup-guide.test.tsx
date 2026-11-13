import type { ReactNode } from 'react';

import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { BookingSetupView } from '@modules/booking/application/contracts/service-views';
import { AddAtLocation } from '@modules/booking/presentation/components/shared/add-at-location';
import { SetupGuide } from '@modules/booking/presentation/components/shared/setup-guide';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MITTE = { id: 'loc-mitte', name: 'Rathaus Mitte' };
const SUED = { id: 'loc-sued', name: 'Bürgeramt Süd' };

const setup = (overrides: Partial<BookingSetupView> = {}): BookingSetupView => ({
  locations: 0,
  services: 0,
  resources: 0,
  team: 0,
  locationChoices: [],
  isTruncated: false,
  ...overrides,
});

describe('AddAtLocation', () => {
  const props = {
    websiteId: 'site',
    hrefAt: (id: string) => `/new/${id}`,
    label: 'Add service',
    labelAt: (name: string) => `At ${name}`,
    labelWithoutLocation: 'Add a location first',
  };

  it('leads to making a location while there is none', async () => {
    await renderServer(<AddAtLocation {...props} locations={[]} />);

    expect(screen.getByRole('link', { name: 'Add a location first' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/new',
    );
  });

  it('goes straight to the only location', async () => {
    await renderServer(<AddAtLocation {...props} locations={[MITTE]} />);

    expect(screen.getByRole('link', { name: 'Add service' })).toHaveAttribute(
      'href',
      '/new/loc-mitte',
    );
  });

  it('asks which location when there are several, and offers each by name', async () => {
    await renderServer(<AddAtLocation {...props} locations={[MITTE, SUED]} />);

    const links = screen.getAllByRole('link', { hidden: true });
    expect(links.map((link) => link.textContent)).toEqual(['At Rathaus Mitte', 'At Bürgeramt Süd']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/new/loc-mitte',
      '/new/loc-sued',
    ]);
  });
});

describe('SetupGuide', () => {
  it('names the four steps in the order they depend on each other and ticks what is done', async () => {
    await renderServer(
      <SetupGuide
        locale="en"
        websiteId="site"
        setup={setup({ locations: 1, locationChoices: [MITTE] })}
      />,
    );

    const steps = within(screen.getByRole('list', { name: 'Set up booking' })).getAllByRole(
      'listitem',
    );
    expect(
      steps.map(
        (step) =>
          within(step).queryByText(/Add a location|Add services|Add resources|Set up your team/)
            ?.textContent,
      ),
    ).toEqual(['Add a location', 'Add services', 'Add resources', 'Set up your team']);
    expect(steps[0]).toHaveTextContent('Done');
    expect(screen.getByText('1 of 4 steps done')).toBeInTheDocument();
  });

  it('is gone once everything is in place', async () => {
    const { container } = await renderServer(
      <SetupGuide
        locale="en"
        websiteId="site"
        setup={setup({ locations: 1, services: 3, resources: 2, team: 1 })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it.each(['locations', 'services', 'resources', 'team'] as const)(
    'stays while there is no %s, in step with the website overview that calls booking done only with all four',
    async (missing) => {
      const full = { locations: 1, services: 3, resources: 2, team: 1 };
      await renderServer(
        <SetupGuide
          locale="en"
          websiteId="site"
          setup={setup({ ...full, [missing]: 0, locationChoices: [MITTE] })}
        />,
      );

      expect(screen.getByRole('list', { name: 'Set up booking' })).toBeInTheDocument();
      expect(screen.getByText('3 of 4 steps done')).toBeInTheDocument();
    },
  );

  it('says when its counts are a lower bound', async () => {
    await renderServer(
      <SetupGuide locale="en" websiteId="site" setup={setup({ isTruncated: true })} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('lower bound');
  });
});
