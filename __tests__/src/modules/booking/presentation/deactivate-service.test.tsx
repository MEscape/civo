import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeactivationImpactDto, ServiceDto } from '@modules/booking/client';
import { ServiceStatusActions } from '@modules/booking/presentation/components/services/service-status-actions.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { SHARED_SERVICE, serviceDto } from '../support/service-dtos';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  deactivate: vi.fn(),
  reactivate: vi.fn(),
  preview: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/deactivate-service-action', () => ({
  deactivateServiceAction: mocks.deactivate,
}));
vi.mock('@modules/booking/presentation/actions/reactivate-service-action', () => ({
  reactivateServiceAction: mocks.reactivate,
}));
vi.mock('@modules/booking/presentation/actions/preview-service-deactivation-action', () => ({
  previewServiceDeactivationAction: mocks.preview,
}));

const IMPACT: DeactivationImpactDto = {
  scope: 'location',
  locationCount: 1,
  futureBookingCount: 2,
  isTruncated: false,
  bookings: [
    {
      bookingId: 'b-1',
      locationId: 'loc-mitte',
      timeZone: 'Europe/Berlin',
      start: '2027-01-12T09:00:00+01:00',
      end: '2027-01-12T09:20:00+01:00',
    },
    {
      bookingId: 'b-2',
      locationId: 'loc-mitte',
      timeZone: 'Europe/Berlin',
      start: '2027-01-12T11:00:00+01:00',
      end: '2027-01-12T11:20:00+01:00',
    },
  ],
};

const renderActions = (service: ServiceDto = serviceDto()) =>
  render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      <ServiceStatusActions service={service} locationId="loc-mitte" />
    </NextIntlClientProvider>,
  );

const open = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
  return screen.findByRole('alertdialog', { name: 'Deactivate service?' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('closing a service', () => {
  it('asks how, says how many bookings are ahead, and starts on blocking new bookings only', async () => {
    renderActions();

    const dialog = await open();

    expect(within(dialog).getByText(/has 6 future bookings/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Block new bookings only/ })).toBeChecked();
    expect(within(dialog).getByText(/Existing appointments stay valid/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Nothing is cancelled automatically/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('radio', { name: /At this location only/ }),
    ).not.toBeInTheDocument();
  });

  it('blocks new bookings only, without any decision about the existing ones, and reads the page again after the server answers', async () => {
    mocks.deactivate.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderActions();

    fireEvent.click(within(await open()).getByRole('button', { name: 'Deactivate service' }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.deactivate).toHaveBeenCalledTimes(1);
    expect(mocks.deactivate).toHaveBeenCalledWith({
      websiteId: 'site',
      serviceId: 'svc-ausweis',
      locationId: 'loc-mitte',
      scope: 'location',
      mode: 'block-new',
      resolutions: [],
      expectedVersion: '2027-01-10T11:00:00.000Z',
      expectedSettingVersion: '2027-01-10T11:00:00.000Z',
    });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('reviews the bookings first when asked: lists them, and keeps closing shut until every one has a decision', async () => {
    mocks.preview.mockResolvedValue({ ok: true, data: IMPACT });
    mocks.deactivate.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderActions();

    const first = await open();
    fireEvent.click(within(first).getByRole('radio', { name: /Review existing bookings/ }));
    fireEvent.click(within(first).getByRole('button', { name: 'Review bookings' }));

    const review = await screen.findByRole('dialog', { name: '2 bookings are affected' });
    expect(mocks.preview).toHaveBeenCalledWith({
      websiteId: 'site',
      serviceId: 'svc-ausweis',
      locationId: 'loc-mitte',
      scope: 'location',
    });
    expect(within(review).getAllByRole('combobox')).toHaveLength(2);
    expect(within(review).getByText(/Nothing is cancelled automatically/)).toBeInTheDocument();
    const confirm = within(review).getByRole('button', { name: /Deactivate service/ });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent('2 bookings still undecided');
    expect(mocks.deactivate).not.toHaveBeenCalled();
  });

  it('shows the refusal of a stale version in words and reads the page again', async () => {
    mocks.deactivate.mockResolvedValue({
      ok: false,
      error: { code: 'booking.service_stale', message: 'stale' },
    });
    renderActions();

    fireEvent.click(within(await open()).getByRole('button', { name: 'Deactivate service' }));

    expect(await screen.findByText(/has changed in the meantime/)).toHaveAttribute('role', 'alert');
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('does not close twice while it waits for the server', async () => {
    let finish: (value: unknown) => void = () => undefined;
    mocks.deactivate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderActions();
    const dialog = await open();
    const confirm = within(dialog).getByRole('button', { name: 'Deactivate service' });

    fireEvent.click(confirm);
    await waitFor(() => {
      expect(confirm).toBeDisabled();
    });
    fireEvent.click(confirm);
    finish({ ok: true, data: { id: 'svc-ausweis' } });

    await waitFor(() => {
      expect(mocks.deactivate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('closing a service that other locations have', () => {
  it('says what closing it everywhere would reach, and closes only this location unless told otherwise', async () => {
    mocks.deactivate.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderActions(SHARED_SERVICE);

    const dialog = await open();
    expect(within(dialog).getByRole('radio', { name: /At this location only/ })).toBeChecked();
    expect(
      within(dialog).getByText(/switched off at all 2 locations: Bürgerbüro Süd/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate service' }));

    await waitFor(() => {
      expect(mocks.deactivate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'location' }));
    });
  });

  it('counts the bookings of every location when closing everywhere is chosen', async () => {
    renderActions(SHARED_SERVICE);
    const dialog = await open();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Everywhere/ }));

    expect(within(dialog).getByText(/has 9 future bookings/)).toBeInTheDocument();
  });
});

describe('opening a service again', () => {
  it('is one plain press with no question, at once and for this location', async () => {
    mocks.reactivate.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderActions(serviceDto({ isActive: false }));

    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => {
      expect(mocks.reactivate).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'location', serviceId: 'svc-ausweis' }),
      );
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a service that is off as a whole as a whole', async () => {
    mocks.reactivate.mockResolvedValue({ ok: true, data: { id: 'svc-ausweis' } });
    renderActions(serviceDto({ isActive: false, isServiceActive: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => {
      expect(mocks.reactivate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'all' }));
    });
  });
});

describe('accessibility of the dialogs', () => {
  it('has no violations axe can find in the question', async () => {
    const { container } = renderActions(SHARED_SERVICE);
    await open();

    await expectNoViolations(container);
  });
});
