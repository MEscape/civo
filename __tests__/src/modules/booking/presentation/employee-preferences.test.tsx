import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PreferencesForm } from '@modules/booking/presentation/components/employee/preferences-form.client';
import type { PreferencesDto } from '@modules/booking/presentation/dto/employee-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), save: vi.fn() }));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/save-employee-preferences-action', () => ({
  saveEmployeePreferencesAction: mocks.save,
}));

const VIEW: PreferencesDto = {
  hasCalendar: true,
  serviceIds: ['s-pass'],
  window: null,
  services: [
    { id: 's-id', name: 'Personalausweis', category: 'Ausweise & Pässe' },
    { id: 's-pass', name: 'Reisepass', category: 'Ausweise & Pässe' },
    { id: 's-melde', name: 'Meldebescheinigung', category: 'Meldewesen' },
  ],
};

const renderForm = (view: PreferencesDto = VIEW) =>
  render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      <PreferencesForm view={view} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the preferences form (mockup 04)', () => {
  it('shows the services by category and no window yet, and nothing about locations', async () => {
    const { container } = renderForm();

    expect(screen.queryByText(/Locations/)).toBeNull();
    expect(screen.getByText('1 of 3 services chosen')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set a time window' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('saves what the form holds: the services chosen and the window set', async () => {
    mocks.save.mockResolvedValue({
      ok: true,
      data: {
        websiteId: 'site',
        serviceIds: ['s-pass', 's-melde'],
        window: { startMinute: 480, endMinute: 780 },
      },
    });
    renderForm();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Meldebescheinigung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set a time window' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledWith({
      websiteId: 'site-1',
      serviceIds: ['s-pass', 's-melde'],
      window: { startMinute: 480, endMinute: 780 },
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('shows the server’s refusal at its field and never says saved', async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: {
        kind: 'validation',
        code: 'booking.validation_failed',
        fieldErrors: { serviceIds: ['booking.validation.service_invalid'] },
      },
    });
    renderForm();

    // Saving is offered only once there is something to save.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Meldebescheinigung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('This service does not exist on this website.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).toBeNull();
  });

  it('refuses a window that ends before it starts without asking the server', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Set a time window' }));
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByLabelText('End')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe('the preferences form in every state', () => {
  const WITH_WINDOW: PreferencesDto = { ...VIEW, window: { startMinute: 480, endMinute: 720 } };

  it('shows a saved window in its fields, and says it is not the working hours, with the way to them', () => {
    renderForm(WITH_WINDOW);

    expect(screen.getByLabelText('Start')).toHaveValue('08:00');
    expect(screen.getByLabelText('End')).toHaveValue('12:00');
    expect(screen.getByText('Appointments in this window are shown to you first.')).toBeVisible();
    expect(screen.getByText(/This is not your working hours/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'My profile' })).toHaveAttribute(
      'href',
      '/bookings/site-1/me/profile',
    );
    expect(screen.queryByRole('button', { name: 'Set a time window' })).toBeNull();
  });

  it('keeps the explanation even when there is no window', () => {
    renderForm();

    expect(screen.getByText(/No preferred time/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'My profile' })).toBeInTheDocument();
  });

  it('removes the window and saves it as none', async () => {
    mocks.save.mockResolvedValue({
      ok: true,
      data: { websiteId: 'site', serviceIds: ['s-pass'], window: null },
    });
    renderForm(WITH_WINDOW);

    fireEvent.click(screen.getByRole('button', { name: 'Remove time window' }));
    expect(screen.getByRole('button', { name: 'Set a time window' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ window: null }));
  });

  it('offers reset and save only once something changed, and reset puts back what was saved', () => {
    renderForm();
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Meldebescheinigung' }));
    expect(reset).toBeEnabled();
    expect(screen.getByText('2 of 3 services chosen')).toBeInTheDocument();

    fireEvent.click(reset);
    expect(screen.getByText('1 of 3 services chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('tells a failure of the server as a whole, keeps what was typed, and never says saved', async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: { kind: 'infrastructure', code: 'infrastructure.unavailable' },
    });
    renderForm();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Meldebescheinigung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(mocks.save).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });
    expect(screen.getByText('Changes not saved yet')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Saved.')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Meldebescheinigung' })).toBeChecked();
  });

  it('works with nothing chosen and nothing offered: no services, no violations', async () => {
    const { container } = renderForm({ ...VIEW, serviceIds: [], services: [] });

    expect(screen.getByText('No service to choose from yet.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    await expectNoViolations(container);
  });

  it('says nothing matches a search that finds no service, and brings the list back when it is cleared', () => {
    renderForm();
    const search = screen.getByRole('searchbox', { name: 'Search services' });

    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No service matches “zzz”.')).toBeInTheDocument();
    expect(screen.queryByText('Meldewesen')).toBeNull();

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.queryByText(/No service matches/)).toBeNull();
    expect(screen.getByText('Meldewesen')).toBeInTheDocument();
  });
});
