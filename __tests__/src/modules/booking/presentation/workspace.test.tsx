import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { offerServiceAction } from '@modules/booking/presentation/actions/offer-service-action';
import { saveLocationAction } from '@modules/booking/presentation/actions/save-location-action';
import { setTeamHoursAction } from '@modules/booking/presentation/actions/set-team-hours-action';
import { LocationWorkspace } from '@modules/booking/presentation/components/setup/location-workspace.client';
import { SetupOverview } from '@modules/booking/presentation/components/setup/setup-overview.client';
import { TeamPanel } from '@modules/booking/presentation/components/team/team-panel.client';
import type {
  BookingOptionsDto,
  LocationWorkspaceDto,
  TeamDto,
} from '@modules/booking/presentation/dto/setup-dto';

import { locationDto, resourceDto, serviceDto } from './fixtures';
import { renderBooking, setup } from './ui-support';

const push = vi.hoisted(() => vi.fn());
vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ refresh: vi.fn(), push }),
}));
vi.mock('@modules/booking/presentation/actions/save-location-action', () => ({
  saveLocationAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/set-team-hours-action', () => ({
  setTeamHoursAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/offer-service-action', () => ({
  offerServiceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-service-action', () => ({
  saveServiceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-resource-action', () => ({
  saveResourceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/preview-service-feasibility-action', () => ({
  previewServiceFeasibilityAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { canBePublished: true, locations: [] },
  }),
}));
vi.mock('@modules/booking/presentation/actions/search-addresses-action', () => ({
  searchAddressesAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

const saveLocation = vi.mocked(saveLocationAction);
const setTeamHours = vi.mocked(setTeamHoursAction);
const offer = vi.mocked(offerServiceAction);

beforeEach(() => {
  push.mockReset();
  saveLocation.mockReset();
  setTeamHours.mockReset();
  offer.mockReset();
});

describe('the setup overview', () => {
  const summary = (overrides = {}) => ({
    id: 'loc-berlin',
    name: 'Town hall',
    address: 'Marktplatz 1',
    isActive: true,
    isOpen: true,
    serviceCount: 2,
    resourceCount: 1,
    ...overrides,
  });

  it('shows each location as a card that says what it holds and opens its workspace', () => {
    renderBooking(<SetupOverview websiteId="site-1" locations={[summary()]} canConfigure />);

    const card = screen.getByRole('link', { name: /Town hall/ });
    expect(card).toHaveAttribute(
      'href',
      expect.stringMatching(/\/websites\/site-1\/bookings\/locations\/loc-berlin$/),
    );
    expect(within(card).getByText('2 services')).toBeInTheDocument();
    expect(within(card).getByText('1 room or device')).toBeInTheDocument();
  });

  it('warns on a location that has no opening hours, since nothing there can be booked', () => {
    renderBooking(
      <SetupOverview websiteId="site-1" locations={[summary({ isOpen: false })]} canConfigure />,
    );

    expect(screen.getByText('No opening hours yet')).toBeInTheDocument();
  });

  it('tells a newcomer where to start, and goes straight into the new location once it exists', async () => {
    const user = setup();
    saveLocation.mockResolvedValue({
      ok: true,
      data: locationDto({ id: 'loc-new', name: 'Library' }),
    });
    renderBooking(<SetupOverview websiteId="site-1" locations={[]} canConfigure />);

    expect(screen.getByText('Start with your first location')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create the first location' }));
    await user.type(screen.getByLabelText('Name'), 'Library');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/websites/site-1/bookings/locations/loc-new');
    });
    // The week it starts with is the office template, to be dragged into shape on the next screen.
    const sent = saveLocation.mock.calls[0]?.[0] as { openingHours: { weekly: unknown[] } };
    expect(sent.openingHours.weekly[0]).toEqual({
      intervals: [{ start: '08:00', end: '16:00' }],
      breaks: [{ start: '12:00', end: '12:30' }],
    });
  });

  it('can start a location closed, to decide the hours later', async () => {
    const user = setup();
    saveLocation.mockResolvedValue({ ok: true, data: locationDto({ id: 'loc-new' }) });
    renderBooking(<SetupOverview websiteId="site-1" locations={[]} canConfigure />);

    await user.click(screen.getByRole('button', { name: 'Create the first location' }));
    await user.type(screen.getByLabelText('Name'), 'Library');
    await user.click(screen.getByRole('button', { name: 'Decide later' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveLocation).toHaveBeenCalled();
    });
    const sent = saveLocation.mock.calls[0]?.[0] as {
      openingHours: { weekly: Array<{ intervals: unknown[] }> };
    };
    expect(sent.openingHours.weekly.every((day) => day.intervals.length === 0)).toBe(true);
  });

  it('offers no way to add a location to someone who may only look', () => {
    renderBooking(
      <SetupOverview websiteId="site-1" locations={[summary()]} canConfigure={false} />,
    );

    expect(screen.queryByRole('button', { name: 'New location' })).toBeNull();
    expect(screen.getByText('You can view this but not change it.')).toBeInTheDocument();
  });
});

describe('the workspace of a location', () => {
  const OPTIONS: BookingOptionsDto = {
    locations: [
      { id: 'loc-berlin', name: 'Town hall', timeZone: 'Europe/Berlin' },
      { id: 'loc-annex', name: 'Annex', timeZone: 'Europe/Berlin' },
    ],
    resources: [],
    services: [],
    skills: [],
    categories: [],
  };

  function workspace(overrides: Partial<LocationWorkspaceDto> = {}): LocationWorkspaceDto {
    return {
      location: locationDto(),
      services: [{ service: serviceDto(), readiness: 'ready' }],
      resources: [
        resourceDto({ id: 'r-room', name: 'Meeting room', type: 'room', locationId: null }),
      ],
      otherServices: [serviceDto({ id: 'svc-other', name: 'Marriage' })],
      ...overrides,
    };
  }

  it('shows the hours first, then the rooms, then what is offered with whether it can be booked', () => {
    renderBooking(<LocationWorkspace workspace={workspace()} options={OPTIONS} canConfigure />);

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Town hall', 'Opening hours', 'Rooms and equipment', 'Services']);
    expect(screen.getByText('Bookable')).toBeInTheDocument();
    expect(screen.getByText(/Needs 1× Service desk/)).toBeInTheDocument();
    expect(screen.getByText('At every location')).toBeInTheDocument();
  });

  it('marks a service that cannot work yet, and one that waits for employees, differently', () => {
    renderBooking(
      <LocationWorkspace
        workspace={workspace({
          services: [
            { service: serviceDto({ id: 'a', name: 'Alpha' }), readiness: 'blocked' },
            { service: serviceDto({ id: 'b', name: 'Beta' }), readiness: 'awaiting-employees' },
          ],
        })}
        options={OPTIONS}
        canConfigure
      />,
    );

    expect(screen.getByText('Not bookable')).toBeInTheDocument();
    expect(screen.getByText('Waiting for employees')).toBeInTheDocument();
  });

  it('saves the opening hours on their own, only once something changed, with the rest of the location untouched', async () => {
    saveLocation.mockResolvedValue({ ok: true, data: locationDto() });
    renderBooking(<LocationWorkspace workspace={workspace()} options={OPTIONS} canConfigure />);
    const save = screen.getByRole('button', { name: 'Save opening hours' });
    expect(save).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday: 08:00 to 16:00' }), {
      key: 'ArrowRight',
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(saveLocation).toHaveBeenCalledTimes(1);
    });
    const sent = saveLocation.mock.calls[0]?.[0] as {
      name: string;
      id: string;
      openingHours: { weekly: Array<{ intervals: unknown[] }> };
    };
    expect(sent).toMatchObject({ id: 'loc-berlin', name: 'Town hall', address: 'Marktplatz 1' });
    expect(sent.openingHours.weekly[0]?.intervals).toEqual([{ start: '08:15', end: '16:15' }]);
  });

  it('lets a change of the hours be taken back before saving', () => {
    renderBooking(<LocationWorkspace workspace={workspace()} options={OPTIONS} canConfigure />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday: 08:00 to 16:00' }), {
      key: 'ArrowRight',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('button', { name: 'Monday: 08:00 to 16:00' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save opening hours' })).toBeDisabled();
  });

  it('offers a service of another location here by choosing it, not by making it again', async () => {
    offer.mockResolvedValue({ ok: true, data: serviceDto({ id: 'svc-other' }) });
    renderBooking(<LocationWorkspace workspace={workspace()} options={OPTIONS} canConfigure />);

    const input = screen.getByRole('combobox', { name: 'Offer an existing service here' });
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Marriage' }));

    await waitFor(() => {
      expect(offer).toHaveBeenCalledWith({
        websiteId: 'site-1',
        serviceId: 'svc-other',
        locationId: 'loc-berlin',
        isOffered: true,
      });
    });
  });

  it('stops offering a shared service here, and only a shared one', async () => {
    offer.mockResolvedValue({ ok: true, data: serviceDto() });
    renderBooking(
      <LocationWorkspace
        workspace={workspace({
          services: [
            {
              service: serviceDto({
                id: 'shared',
                name: 'Shared',
                locationIds: ['loc-berlin', 'loc-annex'],
              }),
              readiness: 'ready',
            },
            {
              service: serviceDto({ id: 'solo', name: 'Solo', locationIds: ['loc-berlin'] }),
              readiness: 'ready',
            },
          ],
        })}
        options={OPTIONS}
        canConfigure
      />,
    );

    expect(screen.getAllByRole('button', { name: /Stop offering here/ })).toHaveLength(1);
    expect(screen.getByText('Also at 1 other location')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Stop offering here/ }));

    await waitFor(() => {
      expect(offer).toHaveBeenCalledWith(
        expect.objectContaining({ serviceId: 'shared', isOffered: false }),
      );
    });
  });

  const EARLY_MONDAY = {
    weekly: [
      { intervals: [{ start: '07:00', end: '12:00' }], breaks: [] },
      ...Array.from({ length: 6 }, () => ({ intervals: [], breaks: [] })),
    ],
    exceptions: [],
  };

  it('opens a service that does not fit here in its form, with the days at fault marked', async () => {
    offer.mockResolvedValue({
      ok: false,
      error: {
        code: 'booking.validation_failed',
        message: 'invalid',
        fieldErrors: {
          'availability.weekly.0.intervals': ['booking.validation.hours_outside_location'],
        },
      },
    });
    renderBooking(
      <LocationWorkspace
        workspace={workspace({
          otherServices: [
            serviceDto({
              id: 'svc-other',
              name: 'Marriage',
              locationIds: ['loc-annex'],
              availability: EARLY_MONDAY,
            }),
          ],
        })}
        options={OPTIONS}
        canConfigure
      />,
    );

    fireEvent.focus(screen.getByRole('combobox', { name: 'Offer an existing service here' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Marriage' }));

    expect(await screen.findByText(/is open at times this location is closed/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Marriage');
    expect(screen.getByText(/Opening hours on Monday/)).toBeInTheDocument();
    // The days at fault are inside a section that starts closed: it opens so they are seen.
    expect(screen.getByText('Bookable times').closest('details')).toHaveAttribute('open');
  });

  it('marks what would be open while the place is closed, and holds the save back', () => {
    renderBooking(
      <LocationWorkspace
        workspace={workspace({
          services: [{ service: serviceDto({ availability: EARLY_MONDAY }), readiness: 'ready' }],
        })}
        options={OPTIONS}
        canConfigure
      />,
    );

    expect(screen.getByText('Hours outside opening hours')).toBeInTheDocument();
    expect(screen.getByText(/Open at times this would close: Passport/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Monday: 08:00 to 16:00' }), {
      key: 'ArrowRight',
    });
    expect(screen.getByRole('button', { name: 'Save opening hours' })).toBeDisabled();
  });

  it('shows a long list of services a page at a time, searchable by name', () => {
    const many = Array.from({ length: 10 }, (_, number) => ({
      service: serviceDto({ id: `svc-${number}`, name: `Service ${number}` }),
      readiness: 'ready' as const,
    }));
    renderBooking(
      <LocationWorkspace
        workspace={workspace({ services: many })}
        options={OPTIONS}
        canConfigure
      />,
    );

    expect(screen.getAllByRole('button', { name: /^Edit Service \d$/ })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(screen.getAllByRole('button', { name: /^Edit Service \d$/ })).toHaveLength(10);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name' }), {
      target: { value: 'Service 7' },
    });
    expect(screen.getAllByRole('button', { name: /^Edit Service \d$/ })).toHaveLength(1);
  });

  it('shows everything but changes nothing for someone who may only look', () => {
    renderBooking(
      <LocationWorkspace workspace={workspace()} options={OPTIONS} canConfigure={false} />,
    );

    expect(screen.queryByRole('button', { name: 'Save opening hours' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New service' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Offer an existing service here' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Monday: 08:00 to 16:00' })).toBeDisabled();
  });
});

describe('the team', () => {
  const team = (members: TeamDto['members']): TeamDto => ({
    members,
    locations: [
      {
        id: 'loc-berlin',
        name: 'Town hall',
        openingHours: locationDto().openingHours,
        staffHours: null,
        employeeHours: locationDto().openingHours,
      },
    ],
    services: [],
  });
  const member = (
    id: string,
    name: string,
    availability: TeamDto['members'][number]['availability'] = null,
  ) => ({
    id,
    name,
    locationId: 'loc-berlin',
    availability,
    isActive: true,
    offeredServiceIds: [],
  });

  it('says how to get people on the team when it is empty', () => {
    renderBooking(<TeamPanel websiteId="site-1" team={team([])} />);

    expect(screen.getByText('Nobody on the team yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite employees' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/websites\/site-1\/users\?invite=employee$/),
    );
  });

  it('says whether each person follows the location or has hours of their own', () => {
    renderBooking(
      <TeamPanel
        websiteId="site-1"
        team={team([member('a', 'Anna'), member('b', 'Ben', locationDto().openingHours)])}
      />,
    );

    const summaryOf = (name: string) => screen.getByText(name).closest('summary');
    expect(summaryOf('Anna')).toHaveTextContent('Same as the location');
    expect(summaryOf('Ben')).toHaveTextContent('Own hours');
  });

  it('saves one person, hands the same hours to the whole team, or takes them back to the location', async () => {
    setTeamHours.mockResolvedValue({ ok: true, data: [] });
    renderBooking(
      <TeamPanel
        websiteId="site-1"
        team={team([
          member('a', 'Anna', locationDto().openingHours),
          member('b', 'Ben'),
          member('c', 'Cem'),
        ])}
      />,
    );
    const anna = screen.getByText('Anna').closest('details');
    if (anna === null) {
      throw new Error('no card for Anna');
    }

    fireEvent.click(within(anna).getByRole('button', { name: 'Save hours' }));
    await waitFor(() => {
      expect(setTeamHours).toHaveBeenCalledWith(
        expect.objectContaining({ websiteId: 'site-1', resourceIds: ['a'] }),
      );
    });

    await waitFor(() => {
      expect(within(anna).getByRole('button', { name: 'Apply to all 3' })).toBeEnabled();
    });
    fireEvent.click(within(anna).getByRole('button', { name: 'Apply to all 3' }));
    await waitFor(() => {
      expect(setTeamHours).toHaveBeenLastCalledWith(
        expect.objectContaining({ resourceIds: ['a', 'b', 'c'] }),
      );
    });

    await waitFor(() => {
      expect(within(anna).getByRole('button', { name: 'Same as the location' })).toBeEnabled();
    });
    fireEvent.click(within(anna).getByRole('button', { name: 'Same as the location' }));
    await waitFor(() => {
      expect(setTeamHours).toHaveBeenLastCalledWith({
        websiteId: 'site-1',
        resourceIds: ['a'],
        availability: null,
      });
    });
  });

  it('draws a person’s week inside the hours of their location, so nothing can be set outside them', () => {
    renderBooking(<TeamPanel websiteId="site-1" team={team([member('a', 'Anna')])} />);

    expect(screen.getByText(/The light area is when the location is open/)).toBeInTheDocument();
  });
});
