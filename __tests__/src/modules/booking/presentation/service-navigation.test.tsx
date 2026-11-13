import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceForm } from '@modules/booking/presentation/components/services/service-form.client';
import { serviceListNavigation } from '@modules/booking/presentation/forms/service-list-navigation';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { OPTIONS, serviceDto } from '../support/service-dtos';

const mocks = vi.hoisted(() => ({ push: vi.fn(), update: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@modules/booking/presentation/actions/update-bookable-service-action', () => ({
  updateBookableServiceAction: mocks.update,
}));
vi.mock('@modules/booking/presentation/actions/create-bookable-service-action', () => ({
  createBookableServiceAction: vi.fn(),
}));

const ORIGIN = 'q=passport&category=Documents&origin=own&status=all&page=3&pageSize=10';

function renderForm({ isWizard = false }: { readonly isWizard?: boolean } = {}) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      <ServiceForm
        websiteId="site"
        locationId="loc-mitte"
        service={serviceDto()}
        part={isWizard ? 'wizard' : 'general'}
        step={isWizard ? 'timing' : 'general'}
        options={OPTIONS}
        listOrigin={ORIGIN}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('service list context', () => {
  it('normalizes only supported list filters and bounds its category page size', () => {
    const origin = serviceListNavigation.parse(
      'q=passport&category=Documents&origin=broken&status=all&page=3&pageSize=999&returnTo=/websites/other',
    );
    expect(serviceListNavigation.parent('site', 'loc-mitte', origin)).toBe(
      '/bookings/site/locations/loc-mitte/services?q=passport&category=Documents&status=all&page=3&pageSize=20',
    );
    expect(serviceListNavigation.parent('site', 'loc-mitte', undefined)).toBe(
      '/bookings/site/locations/loc-mitte/services',
    );
  });

  it('retains context on cancel and after saving a service', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: serviceDto() });
    renderForm();

    const cancel = screen.getByRole('link', { name: 'Cancel' }).getAttribute('href');
    expect(new URLSearchParams(cancel?.split('?')[1]).get('list')).toBe(ORIGIN);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalled();
    });
    const saved = new URLSearchParams(mocks.push.mock.calls[0]?.[0].split('?')[1]);
    expect(saved.get('saved')).toBe('1');
    expect(saved.get('list')).toBe(ORIGIN);
  });

  it('retains context through backward and forward wizard navigation', async () => {
    renderForm({ isWizard: true });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const previous = new URLSearchParams(mocks.push.mock.calls[0]?.[0].split('?')[1]);
    expect(previous.get('step')).toBe('general');
    expect(previous.get('list')).toBe(ORIGIN);

    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledTimes(2);
    });
    const next = new URLSearchParams(mocks.push.mock.calls[1]?.[0].split('?')[1]);
    expect(next.get('step')).toBe('resources');
    expect(next.get('list')).toBe(ORIGIN);
  });
});
