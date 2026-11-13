import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationDto } from '@modules/booking/client';
import { LocationForm } from '@modules/booking/presentation/components/locations/location-form.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { officeWeek } from '../support/location-inputs';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  preview: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@modules/booking/presentation/actions/create-booking-location-action', () => ({
  createBookingLocationAction: mocks.create,
}));
vi.mock('@modules/booking/presentation/actions/update-booking-location-action', () => ({
  updateBookingLocationAction: mocks.update,
}));
vi.mock('@modules/booking/presentation/actions/preview-location-change-action', () => ({
  previewLocationChangeAction: mocks.preview,
}));

const LOCATION: LocationDto = {
  websiteId: 'site',
  id: 'loc-1',
  name: 'Bürgerbüro Mitte',
  address: null,
  timeZone: 'Europe/Berlin',
  isActive: true,
  weekly: officeWeek(),
  exceptions: [],
  version: '2027-01-10T11:00:00.000Z',
  futureBookingCount: 0,
};

function renderForm(
  section: 'basics' | 'hours' | 'wizard' = 'hours',
  options: { readonly listOrigin?: string; readonly step?: 'basics' | 'hours' } = {},
) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <LocationForm
        websiteId="site"
        location={LOCATION}
        section={section}
        step={options.step ?? 'basics'}
        listOrigin={options.listOrigin}
        timeZones={['Europe/Berlin', 'UTC']}
        years={[2027]}
        tiles={null}
      />
    </NextIntlClientProvider>,
  );
}

const saved = { ok: true, data: { ...LOCATION } };

/**
 * Shortens Friday from 16:00 to 14:00, the way a manager would on the bar, so the hours differ from
 * what was loaded. Two large keyboard steps; opening the exact fields of a row would render far more.
 */
function shortenFriday() {
  const fridayEnd = screen.getByRole('slider', { name: /Friday, period 1: end/ });
  for (let step = 0; step < 2; step += 1) {
    fireEvent.keyDown(fridayEnd, { key: 'ArrowLeft', shiftKey: true });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LocationForm (changing hours)', () => {
  it('keeps the originating list on cancellation and after saving', async () => {
    mocks.update.mockResolvedValue(saved);
    renderForm('basics', { listOrigin: 'q=hall&status=active&page=3&pageSize=10' });

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/bookings/site/locations/loc-1?list=q%3Dhall%26status%3Dactive%26page%3D3%26pageSize%3D10',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-1?saved=1&list=q%3Dhall%26status%3Dactive%26page%3D3%26pageSize%3D10',
      );
    });
  });

  it('keeps the originating list while moving backward and forward through editing steps', async () => {
    renderForm('wizard', { listOrigin: 'page=3&pageSize=10', step: 'hours' });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(mocks.push).toHaveBeenCalledWith(
      '/bookings/site/locations/loc-1/edit?section=all&step=basics&list=page%3D3%26pageSize%3D10',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(
        '/bookings/site/locations/loc-1/edit?section=all&step=exceptions&list=page%3D3%26pageSize%3D10',
      );
    });
  });

  it('saves hours that did not change without asking about bookings, and arrives at the location', async () => {
    mocks.update.mockResolvedValue(saved);
    renderForm('basics');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining('saved=1'));
    });
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: 'loc-1',
        expectedVersion: LOCATION.version,
        acknowledgeImpact: false,
      }),
    );
  });

  it('saves changed hours straight away when no booking is affected', async () => {
    mocks.preview.mockResolvedValue({ ok: true, data: { affected: [], isTruncated: false } });
    mocks.update.mockResolvedValue(saved);
    renderForm();

    shortenFriday();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledOnce();
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ acknowledgeImpact: false }),
    );
  });

  it('shows the affected bookings first and saves only after the manager has seen them', async () => {
    mocks.preview.mockResolvedValue({
      ok: true,
      data: {
        isTruncated: false,
        affected: [
          {
            bookingId: 'b-1',
            serviceId: 's-1',
            timeZone: 'Europe/Berlin',
            start: '2027-01-15T14:30:00.000Z',
            end: '2027-01-15T15:00:00.000Z',
            reason: 'outside-opening-hours',
          },
        ],
      },
    });
    mocks.update.mockResolvedValue(saved);
    renderForm();

    shortenFriday();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(await screen.findByText('1 booking is affected')).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByText('Friday will close at 14:00 instead of 16:00.')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Save anyway', hidden: true });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ acknowledgeImpact: true }),
      );
    });
  });

  it('saves nothing when the manager goes back from the review', async () => {
    mocks.preview.mockResolvedValue({
      ok: true,
      data: {
        isTruncated: false,
        affected: [
          {
            bookingId: 'b-1',
            serviceId: 's-1',
            timeZone: 'Europe/Berlin',
            start: '2027-01-15T14:30:00.000Z',
            end: '2027-01-15T15:00:00.000Z',
            reason: 'outside-opening-hours',
          },
        ],
      },
    });
    renderForm();

    shortenFriday();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('1 booking is affected');
    fireEvent.click(screen.getByRole('button', { name: 'Back', hidden: true }));

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('tells the manager the location was changed by someone else, and does not arrive anywhere', async () => {
    mocks.update.mockResolvedValue({
      ok: false,
      error: { code: 'booking.location_stale', message: 'stale' },
    });
    renderForm('basics');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe('LocationForm (creating, in the wizard)', () => {
  function renderWizard(step: 'basics' | 'review') {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ ...enBooking, app: enApp }}
        timeZone="Europe/Berlin"
      >
        <LocationForm
          websiteId="site"
          location={null}
          section="wizard"
          step={step}
          timeZones={['Europe/Berlin', 'UTC']}
          years={[2027]}
          tiles={null}
        />
      </NextIntlClientProvider>,
    );
  }

  it('takes the manager to the step with the error when the review is saved with a field missing', async () => {
    renderWizard('review');

    fireEvent.click(screen.getByRole('button', { name: 'Save location' }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining('step=basics'));
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not go on from the basics while the name is missing, and stays where the error shows', async () => {
    renderWizard('basics');

    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));

    expect(await screen.findByText(/name/i)).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
