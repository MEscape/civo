import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResourceDto } from '@modules/booking/client';
import { ResourceBlockDialog } from '@modules/booking/presentation/components/resources/resource-block-dialog.client';
import { ResourceForm } from '@modules/booking/presentation/components/resources/resource-form.client';
import { ResourceOverview } from '@modules/booking/presentation/components/resources/resource-overview';
import { resourceListNavigation } from '@modules/booking/presentation/forms/resource-list-navigation';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { officeWeek } from '../support/location-inputs';
import { renderServer } from '../support/server-render';

const mocks = vi.hoisted(() => ({ push: vi.fn(), update: vi.fn(), preview: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@modules/booking/presentation/actions/update-bookable-resource-action', () => ({
  updateBookableResourceAction: mocks.update,
}));
vi.mock('@modules/booking/presentation/actions/preview-resource-change-action', () => ({
  previewResourceChangeAction: mocks.preview,
}));
vi.mock('@modules/booking/presentation/actions/create-bookable-resource-action', () => ({
  createBookableResourceAction: vi.fn(),
}));

const ORIGIN = 'q=room&type=meeting-room&page=3&pageSize=25';
const RESOURCE: ResourceDto = {
  websiteId: 'site',
  id: 'room',
  name: 'Meeting room',
  type: 'meeting-room',
  places: 4,
  location: { id: 'office', name: 'City hall' },
  status: 'active',
  usedBy: [],
  today: { timeZone: 'Europe/Berlin', window: null, busy: [], peak: 0 },
  setupMinutes: 0,
  teardownMinutes: 0,
  internalNote: '',
  followsLocation: true,
  weekly: officeWeek(),
  locationWeekly: officeWeek(),
  blocks: [],
  version: '2027-01-10T11:00:00.000Z',
};

function inIntl(children: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ ...enBooking, app: enApp }}
      timeZone="Europe/Berlin"
    >
      {children}
    </NextIntlClientProvider>,
  );
}

function renderForm({ isWizard = false }: { readonly isWizard?: boolean } = {}) {
  return inIntl(
    <ResourceForm
      websiteId="site"
      location={{ ...RESOURCE.location, weekly: RESOURCE.locationWeekly }}
      resource={RESOURCE}
      section={isWizard ? 'wizard' : 'basics'}
      step={isWizard ? 'availability' : 'basics'}
      listOrigin={ORIGIN}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resource list context', () => {
  it('normalizes only supported filters and bounds the list size', () => {
    const origin = resourceListNavigation.parse(
      'q=room&type=broken&page=3&pageSize=999&returnTo=/websites/other',
    );
    expect(resourceListNavigation.parent('site', 'office', origin)).toBe(
      '/bookings/site/locations/office/resources?q=room&page=3&pageSize=50',
    );
    expect(resourceListNavigation.parent('site', 'office', undefined)).toBe(
      '/bookings/site/locations/office/resources',
    );
  });

  it('retains context in each editable section of the resource overview', async () => {
    await renderServer(
      <ResourceOverview
        locale="en"
        resource={RESOURCE}
        mayConfigure
        isSaved={false}
        listOrigin={ORIGIN}
      />,
    );
    const links = screen.getAllByRole('link', { name: /^Edit:/ });
    expect(links).toHaveLength(2);
    expect(
      links.map((link) =>
        new URLSearchParams(link.getAttribute('href')?.split('?')[1]).get('list'),
      ),
    ).toEqual([ORIGIN, ORIGIN]);
  });

  it('retains context on cancel and after saving a resource', async () => {
    mocks.update.mockResolvedValue({ ok: true, data: RESOURCE });
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
    expect(previous.get('step')).toBe('basics');
    expect(previous.get('list')).toBe(ORIGIN);

    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledTimes(2);
    });
    const next = new URLSearchParams(mocks.push.mock.calls[1]?.[0].split('?')[1]);
    expect(next.get('step')).toBe('review');
    expect(next.get('list')).toBe(ORIGIN);
  });

  it('retains context after blocking a resource from its overview', async () => {
    mocks.preview.mockResolvedValue({ ok: true, data: { affected: [], isTruncated: false } });
    mocks.update.mockResolvedValue({ ok: true, data: RESOURCE });
    inIntl(<ResourceBlockDialog resource={RESOURCE} listOrigin={ORIGIN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Block Meeting room' });
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '2027-01-20' } });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '2027-01-21' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block' }));
    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalled();
    });
    expect(new URLSearchParams(mocks.push.mock.calls[0]?.[0].split('?')[1]).get('list')).toBe(
      ORIGIN,
    );
  });
});
