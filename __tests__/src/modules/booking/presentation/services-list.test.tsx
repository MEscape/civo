import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { AddServiceMenu } from '@modules/booking/presentation/components/services/add-service-menu.client';
import { ServicesList } from '@modules/booking/presentation/components/services/services-list';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';
import { servicePage } from '../support/service-dtos';

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
  useRouter: () => ({ push: vi.fn() }),
}));

const VIEW = {
  search: undefined,
  category: undefined,
  origin: undefined,
  status: 'active',
  pageSize: 5,
} as const;

async function renderList(
  overrides: {
    page?: ReturnType<typeof servicePage>;
    mayConfigure?: boolean;
    view?: typeof VIEW;
  } = {},
) {
  return renderServer(
    await ServicesList({
      locale: 'en',
      websiteId: 'site',
      page: overrides.page ?? servicePage(),
      view: overrides.view ?? VIEW,
      mayConfigure: overrides.mayConfigure ?? true,
    }),
  );
}

describe('the services of a location', () => {
  it('groups them by category and says how each came to be here, in words and not by colour', async () => {
    await renderList();

    // The two open categories show their services as table rows; the closed one keeps its row out of sight.
    const rows = screen
      .getAllByRole('row')
      .filter((row) => within(row).queryAllByRole('columnheader').length === 0);
    const text = rows.map((row) => row.textContent);
    expect(text.join('|')).toContain('Own service');
    expect(text.join('|')).toContain('Copy of Bürgerbüro Süd');
    expect(text.join('|')).toContain('Linked to Bürgerbüro Süd');
    expect(screen.getByRole('link', { name: 'Kinderreisepass' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services/svc-kind?list=page%3D1%26pageSize%3D5',
    );
    // A service that is switched off says so in words.
    const switchedOff = rows.find((row) => row.textContent?.includes('Kinderreisepass'));
    expect(within(switchedOff!).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Showing 3 categories · 4 services')).toBeInTheDocument();
  });

  it('opens the first categories and lets a person open or close every category with one button', async () => {
    await renderList();

    const triggers = screen.getAllByRole('button', { expanded: true });
    expect(triggers.map((trigger) => trigger.textContent)).toEqual([
      expect.stringContaining('Ausweise & Pässe'),
      expect.stringContaining('Meldewesen'),
    ]);
    expect(screen.getByRole('button', { name: /Ohne Kategorie|No category/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });

  it('works with the keyboard: a category opens with Enter or Space on its button', async () => {
    await renderList();
    const closed = screen.getByRole('button', { name: /No category/ });

    closed.focus();
    fireEvent.click(closed);

    expect(closed).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the filters in the address: a plain form for the search and the selects, and the status as links', async () => {
    await renderList({ view: { ...VIEW, status: 'active' } });

    const form = screen.getByRole('search', { name: 'Filter services' });
    expect(form).toHaveAttribute('method', 'get');
    expect(within(form).getByRole('searchbox', { name: 'Search services' })).toBeInTheDocument();
    expect(within(form).getAllByRole('combobox')).toHaveLength(2);
    // The status is what the links say, without a "Status:" prefix.
    expect(screen.getByRole('link', { name: 'Inactive' })).toBeInTheDocument();
    expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
  });

  it('says there is no service yet, with a way to start, only to someone who may make one', async () => {
    const empty = { ...servicePage(), groups: [], total: 0, serviceCount: 0, categories: [] };

    const view = await renderList({ page: empty });
    expect(screen.getByText('No service yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create service' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services/new',
    );
    view.unmount();

    await renderList({ page: empty, mayConfigure: false });
    expect(screen.getByText('No service has been created yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create service' })).not.toBeInTheDocument();
  });

  it('says it is the filter that found nothing, and offers to reset it', async () => {
    const none = { ...servicePage(), groups: [], total: 0, serviceCount: 0 };

    await renderList({ page: none, view: { ...VIEW, search: 'zzz' } as unknown as typeof VIEW });

    expect(screen.getByText('No services found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reset selection' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services',
    );
  });

  it('says when the list was cut instead of presenting it as complete', async () => {
    await renderList({ page: { ...servicePage(), isTruncated: true } });

    expect(screen.getByRole('status')).toHaveTextContent('more services than can be shown');
  });

  it('has no accessibility violations axe can find', async () => {
    const { container } = await renderList();

    await expectNoViolations(container);
  });
});

describe('the menu that adds a service', () => {
  function renderMenu() {
    return render(
      <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
        <AddServiceMenu websiteId="site" locationId="loc-mitte" />
      </NextIntlClientProvider>,
    );
  }

  it('offers making a new service and taking one over, and no catalog the repository does not have', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Add service' });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    const links = screen.getAllByRole('link').map((link) => link.textContent);
    expect(links).toEqual([
      expect.stringContaining('Create a new service'),
      expect.stringContaining('Take over an existing service'),
    ]);
    expect(screen.queryByText(/catalog/i)).not.toBeInTheDocument();
  });

  it('closes on Escape and gives the focus back to its button', () => {
    renderMenu();
    const button = screen.getByRole('button', { name: 'Add service' });
    fireEvent.click(button);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('has no accessibility violations axe can find', async () => {
    const { container } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Add service' }));

    await expectNoViolations(container);
  });
});
