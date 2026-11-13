import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdoptServiceScreen } from '@modules/booking/presentation/components/services/adopt-service-screen';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';
import { adoptablePage } from '../support/service-dtos';

const mocks = vi.hoisted(() => ({ push: vi.fn(), adopt: vi.fn() }));

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
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));
vi.mock('@modules/booking/presentation/actions/adopt-service-action', () => ({
  adoptServiceAction: mocks.adopt,
}));

const VIEW = { search: undefined, source: undefined, pageSize: 10 } as const;

const renderScreen = (view: { service?: string; from?: string } = {}) =>
  renderServer(
    <AdoptServiceScreen
      locale="en"
      websiteId="site"
      page={adoptablePage()}
      view={{ ...VIEW, service: view.service, from: view.from }}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('taking over a service from another location', () => {
  it('lists what other locations offer, with where each comes from, and waits for a pick', async () => {
    await renderServer(
      <AdoptServiceScreen
        locale="en"
        websiteId="site"
        page={adoptablePage()}
        view={{ ...VIEW, service: undefined, from: undefined }}
      />,
    );

    const list = screen.getByRole('list', { name: 'Services of other locations' });
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).getByText('Bürgerbüro Süd · 30 min')).toBeInTheDocument();
    expect(screen.getByText('Nothing chosen yet')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('makes the pick a link, so it survives filtering and a reload, and marks the picked row in words', async () => {
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    const picked = screen.getByRole('link', { current: true });
    expect(picked).toHaveTextContent('Wohnsitz anmelden');
    expect(within(picked).getByText('Chosen')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Wohnsitz abmelden/ })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services/adopt?service=svc-b&from=loc-sued&pageSize=10',
    );
  });

  it('offers an independent copy by default, with what it means, an example and what is carried over', async () => {
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    expect(screen.getByRole('radio', { name: /Independent copy/ })).toBeChecked();
    expect(screen.getByText(/The original stays unchanged/)).toBeInTheDocument();
    expect(screen.getByText(/Carried over: description, duration, buffers/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take over as copy' })).toBeInTheDocument();
  });

  it('asks the server to take it over as a copy, and arrives at the new service only after it answers', async () => {
    mocks.adopt.mockResolvedValue({ ok: true, data: { id: 'new-service' } });
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    fireEvent.click(screen.getByRole('button', { name: 'Take over as copy' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-mitte/services/new-service?saved=1',
      );
    });
    expect(mocks.adopt).toHaveBeenCalledTimes(1);
    expect(mocks.adopt).toHaveBeenCalledWith({
      websiteId: 'site',
      locationId: 'loc-mitte',
      serviceId: 'svc-a',
      sourceLocationId: 'loc-sued',
      mode: 'copy',
    });
  });

  it('takes it over linked when that is chosen, and says what linking means', async () => {
    mocks.adopt.mockResolvedValue({ ok: true, data: { id: 'svc-a' } });
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    fireEvent.click(screen.getByRole('radio', { name: /Linked to the original/ }));
    expect(
      screen.getByText(/Changes to the original apply here automatically/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Take over linked' }));

    await waitFor(() => {
      expect(mocks.adopt).toHaveBeenCalledWith(expect.objectContaining({ mode: 'link' }));
    });
  });

  it('shows the refusal in words, keeps the choice, and navigates nowhere', async () => {
    mocks.adopt.mockResolvedValue({
      ok: false,
      error: { code: 'booking.service_already_offered', message: 'x' },
    });
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    fireEvent.click(screen.getByRole('button', { name: 'Take over as copy' }));

    expect(await screen.findByText(/already offered at this location/)).toHaveAttribute(
      'role',
      'alert',
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Independent copy/ })).toBeChecked();
  });

  it('does not send twice while it waits for the server', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.adopt.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderScreen({ service: 'svc-a', from: 'loc-sued' });
    const button = screen.getByRole('button', { name: 'Take over as copy' });

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
    fireEvent.click(button);
    finish({ ok: true, data: { id: 'x' } });

    await waitFor(() => {
      expect(mocks.adopt).toHaveBeenCalledTimes(1);
    });
  });

  it('says there is nothing to take over when no other location offers anything', async () => {
    const empty = { ...adoptablePage(), items: [], total: 0, sources: [] };
    await renderServer(
      <AdoptServiceScreen
        locale="en"
        websiteId="site"
        page={empty}
        view={{ ...VIEW, service: undefined, from: undefined }}
      />,
    );

    expect(screen.getByText('No service to take over')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a new service' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-mitte/services/new',
    );
  });

  it('has no accessibility violations axe can find', async () => {
    const { container } = await renderScreen({ service: 'svc-a', from: 'loc-sued' });

    await expectNoViolations(container);
  });
});
