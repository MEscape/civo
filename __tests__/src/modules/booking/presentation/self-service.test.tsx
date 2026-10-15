import type { ReactNode } from 'react';

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { saveOwnProfileAction } from '@modules/booking/presentation/actions/save-own-profile-action';
import { OwnProfileForm } from '@modules/booking/presentation/components/admin/own-profile-form.client';
import type { OwnProfileDto } from '@modules/booking/presentation/dto/setup-dto';

import { OPENING_HOURS, resourceDto, setupDto } from './fixtures';
import { renderBooking, setup } from './ui-support';
import { ServicesAtLocation } from './workspace-support';

vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@modules/booking/presentation/actions/save-own-profile-action', () => ({
  saveOwnProfileAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-service-action', () => ({
  saveServiceAction: vi.fn(),
}));

const save = vi.mocked(saveOwnProfileAction);

const OWN: OwnProfileDto = {
  profile: null,
  offeredServiceIds: [],
  services: [
    { id: 'svc-passport', name: 'Passport', locationIds: ['loc-berlin'] },
    { id: 'svc-parking', name: 'Parking permit', locationIds: ['loc-berlin'] },
  ],
  locations: [
    {
      id: 'loc-berlin',
      name: 'Town hall',
      timeZone: 'Europe/Berlin',
      employeeHours: OPENING_HOURS,
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('an employee setting up their own calendar', () => {
  const pick = (name: string) => {
    fireEvent.focus(screen.getByRole('combobox', { name: 'Services I offer' }));
    fireEvent.mouseDown(screen.getByRole('option', { name }));
  };

  it('sends the name, the one location and exactly the services they chose', async () => {
    save.mockResolvedValue({ ok: true, data: resourceDto({ id: 'res-own' }) });
    const user = setup();
    renderBooking(<OwnProfileForm websiteId="site-1" own={OWN} />);

    await user.type(screen.getByLabelText('Name shown'), 'Anna');
    pick('Parking permit');
    await user.click(screen.getByRole('button', { name: 'Save my calendar' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      websiteId: 'site-1',
      name: 'Anna',
      locationId: 'loc-berlin',
      offeredServiceIds: ['svc-parking'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
  });

  it('does not send a calendar without a name', async () => {
    const user = setup();
    renderBooking(<OwnProfileForm websiteId="site-1" own={OWN} />);

    await user.click(screen.getByRole('button', { name: 'Save my calendar' }));

    expect(save).not.toHaveBeenCalled();
  });

  it('starts from what is saved, with the offered services chosen', () => {
    renderBooking(
      <OwnProfileForm
        websiteId="site-1"
        own={{
          ...OWN,
          profile: resourceDto({ id: 'res-own', name: 'Anna B.' }),
          offeredServiceIds: ['svc-passport'],
        }}
      />,
    );

    expect(screen.getByLabelText('Name shown')).toHaveValue('Anna B.');
    expect(screen.getByRole('list', { name: 'Services I offer' })).toHaveTextContent('Passport');
    fireEvent.focus(screen.getByRole('combobox', { name: 'Services I offer' }));
    expect(screen.queryByRole('option', { name: 'Passport' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Parking permit' })).toBeInTheDocument();
  });

  it('says so when no service is offered at the location yet', () => {
    renderBooking(<OwnProfileForm websiteId="site-1" own={{ ...OWN, services: [] }} />);

    expect(screen.getByText(/No services are offered at this location yet/)).toBeInTheDocument();
  });

  it('offers the services of the chosen location, and takes off those it does not offer', async () => {
    const user = setup();
    renderBooking(
      <OwnProfileForm
        websiteId="site-1"
        own={{
          ...OWN,
          profile: resourceDto({ id: 'res-own', locationId: 'loc-berlin' }),
          offeredServiceIds: ['svc-passport', 'svc-parking'],
          services: [
            { id: 'svc-passport', name: 'Passport', locationIds: ['loc-berlin', 'loc-annex'] },
            { id: 'svc-parking', name: 'Parking permit', locationIds: ['loc-berlin'] },
          ],
          locations: [...OWN.locations, { ...OWN.locations[0]!, id: 'loc-annex', name: 'Annex' }],
        }}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Where I work' }));
    await user.click(await screen.findByRole('option', { name: 'Annex' }));

    expect(screen.getByRole('list', { name: 'Services I offer' })).toHaveTextContent('Passport');
    expect(screen.getByRole('list', { name: 'Services I offer' })).not.toHaveTextContent('Parking');
    expect(screen.getByText(/1 service was taken off/)).toBeInTheDocument();
  });
});

describe('an employee choosing where to work', () => {
  const MORNINGS = { intervals: [{ start: '08:00', end: '12:00' }], breaks: [] };
  const TWO_PLACES: OwnProfileDto = {
    ...OWN,
    locations: [
      ...OWN.locations,
      {
        id: 'loc-annex',
        name: 'Annex',
        timeZone: 'Europe/Berlin',
        employeeHours: { weekly: Array.from({ length: 7 }, () => MORNINGS), exceptions: [] },
      },
    ],
  };

  it('has no hours to set until a location is chosen, since the hours stay inside its own', () => {
    renderBooking(<OwnProfileForm websiteId="site-1" own={TWO_PLACES} />);

    expect(screen.getByText(/Choose your location first: your working hours/)).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /Monday, end/ })).toBeNull();
  });

  it('is cut back to the hours of the location chosen, before anything is saved', async () => {
    save.mockResolvedValue({ ok: true, data: resourceDto({ id: 'res-own' }) });
    const user = setup();
    renderBooking(<OwnProfileForm websiteId="site-1" own={TWO_PLACES} />);

    await user.click(screen.getByRole('combobox', { name: 'Where I work' }));
    await user.click(await screen.findByRole('option', { name: 'Town hall' }));
    await user.click(screen.getByRole('combobox', { name: 'Where I work' }));
    await user.click(await screen.findByRole('option', { name: 'Annex' }));
    await user.type(screen.getByLabelText('Name shown'), 'Anna');
    await user.click(screen.getByRole('button', { name: 'Save my calendar' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalled();
    });
    const sent = save.mock.calls[0]?.[0] as {
      availability: { weekly: Array<{ intervals: unknown[] }> };
    };
    expect(sent.availability.weekly[0]?.intervals).toEqual([{ start: '08:00', end: '12:00' }]);
  });
});

describe('templates for setting up quickly', () => {
  const fixture = setupDto({ services: [] });
  const options = {
    locations: fixture.locations.map(({ id, name, timeZone }) => ({ id, name, timeZone })),
    resources: [],
    services: [],
    skills: [],
    categories: [],
  };

  it('fill the form with what is usual, for the person to review before saving', async () => {
    const user = setup();
    renderBooking(<ServicesAtLocation services={[]} options={options} canConfigure />);

    await user.click(screen.getByRole('button', { name: 'Consultation (45 min)' }));

    expect(screen.getByLabelText('Name')).toHaveValue('Consultation (45 min)');
    expect(screen.getByLabelText(/^Duration/)).toHaveValue(45);
  });

  it('are not offered to someone who may not configure', () => {
    renderBooking(<ServicesAtLocation services={[]} options={options} canConfigure={false} />);

    expect(screen.queryByRole('button', { name: 'Consultation (45 min)' })).toBeNull();
  });
});
