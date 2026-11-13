import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { ServiceDto } from '@modules/booking/client';
import { ServiceOverview } from '@modules/booking/presentation/components/services/service-overview';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';
import { SHARED_SERVICE, serviceDto } from '../support/service-dtos';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@i18n', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    'aria-label'?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

const renderOverview = (
  service: ServiceDto = serviceDto(),
  options: { mayConfigure?: boolean; isSaved?: boolean } = {},
) =>
  renderServer(
    <ServiceOverview
      locale="en"
      websiteId="site"
      service={service}
      mayConfigure={options.mayConfigure ?? true}
      isSaved={options.isSaved ?? false}
    />,
  );

describe('the overview of a service', () => {
  it('keeps the originating list in every section editor link', async () => {
    const origin = 'q=passport&status=all&page=3&pageSize=10';
    await renderServer(
      <ServiceOverview
        locale="en"
        websiteId="site"
        service={serviceDto()}
        mayConfigure
        isSaved={false}
        listOrigin={origin}
      />,
    );

    const links = screen.getAllByRole('link', { name: /^Edit:/ });
    expect(links).toHaveLength(4);
    expect(
      links.map((link) =>
        new URLSearchParams(link.getAttribute('href')?.split('?')[1]).get('list'),
      ),
    ).toEqual([origin, origin, origin, origin]);
  });

  it('says what is set in each part, worked out from the data, in the mockup’s words', async () => {
    await renderOverview();

    const rows = screen.getByRole('list', { name: 'Parts of the service' });
    const text = (title: RegExp) =>
      within(rows).getByRole('heading', { name: title }).closest('li')?.textContent ?? '';
    expect(text(/General/)).toContain(
      'Personalausweis beantragen · Ausweise & Pässe · bookable online',
    );
    expect(text(/General/)).toContain('Documents: Altes Dokument, biometrisches Foto');
    // Preparation 5 and follow-up 10 hold the employee 35 minutes; the counter, set up by itself, 20.
    expect(text(/Duration/)).toContain('20 min appointment · Employee 35 min · Schalter 20 min');
    expect(text(/Resources/)).toContain('Schalter (required) · Besprechungsraum (optional)');
    expect(text(/Rules/)).toContain(
      'Booking 1 day–90 days · Cancellation until 1 day · Qualification Ausweise',
    );
  });

  it('gives each part its own way in, named by the part, and none to someone who may only look', async () => {
    const view = await renderOverview();
    const links = screen.getAllByRole('link', { name: /^Edit:/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/bookings/site/locations/loc-mitte/services/svc-ausweis/edit?section=general',
      '/bookings/site/locations/loc-mitte/services/svc-ausweis/edit?section=timing',
      '/bookings/site/locations/loc-mitte/services/svc-ausweis/edit?section=resources',
      '/bookings/site/locations/loc-mitte/services/svc-ausweis/edit?section=rules',
    ]);
    view.unmount();

    await renderOverview(serviceDto(), { mayConfigure: false });
    expect(screen.queryAllByRole('link', { name: /^Edit:/ })).toHaveLength(0);
  });

  it('shows how it is running and where it came from as words with a symbol, never colour alone', async () => {
    await renderOverview(
      serviceDto({
        origin: { kind: 'copy', from: { id: 's', name: 'Bürgerbüro Süd' } },
        isActive: false,
      }),
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Bookable online')).toBeInTheDocument();
    expect(screen.getByText('Copy of Bürgerbüro Süd')).toBeInTheDocument();
    expect(screen.getByText('6 future bookings')).toBeInTheDocument();
  });

  it('says, while bookings are ahead, that a change reaches new bookings only', async () => {
    await renderOverview();

    expect(
      screen.getByText(
        /Changes to duration, buffers, rules or qualification apply to new bookings only/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/The 6 future bookings stay unchanged/)).toBeInTheDocument();
  });

  it('says nothing of the kind when no booking is ahead', async () => {
    await renderOverview(serviceDto({ futureBookingCount: 0 }));

    expect(screen.queryByText(/apply to new bookings only/)).not.toBeInTheDocument();
    expect(screen.getByText('No future bookings')).toBeInTheDocument();
  });

  it('names the other locations a shared service reaches and what stays local', async () => {
    await renderOverview(SHARED_SERVICE);

    expect(screen.getByText('Shared with 2 locations')).toBeInTheDocument();
    expect(screen.getByText(/also offered at: Bürgerbüro Süd/)).toBeInTheDocument();
    expect(screen.getByText(/Changeable here only: whether the service runs/)).toBeInTheDocument();
  });

  it('warns that a service off as a whole is bookable nowhere, and that a reservation of nothing reserves nothing', async () => {
    await renderOverview(serviceDto({ isServiceActive: false, resources: [], employee: 'none' }));

    expect(screen.getByText(/switched off as a whole/)).toBeInTheDocument();
    expect(screen.getByText(/nothing is reserved/)).toBeInTheDocument();
  });

  it('confirms a save only when it arrived from one the server confirmed', async () => {
    const view = await renderOverview(serviceDto(), { isSaved: true });
    expect(screen.getByRole('status')).toHaveTextContent('Your changes to the service are saved.');
    view.unmount();

    await renderOverview(serviceDto(), { isSaved: false });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('has no accessibility violations axe can find', async () => {
    const { container } = await renderOverview(SHARED_SERVICE);

    await expectNoViolations(container);
  });
});
