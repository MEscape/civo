import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cancelBookingAsStaffAction } from '@modules/booking/presentation/actions/cancel-booking-as-staff-action';
import { completeBookingAction } from '@modules/booking/presentation/actions/complete-booking-action';
import { getOperationsCalendarAction } from '@modules/booking/presentation/actions/get-operations-calendar-action';
import { markBookingNoShowAction } from '@modules/booking/presentation/actions/mark-booking-no-show-action';
import { saveServiceAction } from '@modules/booking/presentation/actions/save-service-action';
import type { CalendarAdapterProps } from '@modules/booking/presentation/components/admin/calendar-adapter.client';
import { OperationsCalendar } from '@modules/booking/presentation/components/admin/operations-calendar.client';

import { calendarBooking, locationDto, resourceDto, serviceDto, setupDto } from './fixtures';
import { failure, renderBooking, setup } from './ui-support';
import { ServicesAtLocation } from './workspace-support';

import type { SetupFixture } from './fixtures';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

/**
 * Stands in for the calendar widget: it draws each event as a button and
 * reports a fixed visible week. The real adapter is a thin wrapper around
 * FullCalendar and is covered by its own test.
 */
vi.mock('@modules/booking/presentation/components/admin/calendar-view.client', async () => {
  const { useEffect } = await import('react');
  return {
    CalendarView: ({ events, onRangeChange, onEventSelect }: CalendarAdapterProps) => {
      useEffect(() => {
        onRangeChange({ from: '2026-10-12', to: '2026-10-18' });
      }, [onRangeChange]);
      return (
        <ul aria-label="calendar">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => {
                  onEventSelect(event.id);
                }}
              >
                {event.title} {event.start}
              </button>
            </li>
          ))}
        </ul>
      );
    },
  };
});

vi.mock('@modules/booking/presentation/actions/get-operations-calendar-action', () => ({
  getOperationsCalendarAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/cancel-booking-as-staff-action', () => ({
  cancelBookingAsStaffAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/complete-booking-action', () => ({
  completeBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/mark-booking-no-show-action', () => ({
  markBookingNoShowAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/reschedule-booking-as-staff-action', () => ({
  rescheduleBookingAsStaffAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/get-available-slots-action', () => ({
  getAvailableSlotsAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-service-action', () => ({
  saveServiceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-resource-action', () => ({
  saveResourceAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/save-location-action', () => ({
  saveLocationAction: vi.fn(),
}));

const loadCalendar = vi.mocked(getOperationsCalendarAction);
const cancel = vi.mocked(cancelBookingAsStaffAction);
const complete = vi.mocked(completeBookingAction);
const noShow = vi.mocked(markBookingNoShowAction);
const saveService = vi.mocked(saveServiceAction);

function calendarOf(...bookings: Array<ReturnType<typeof calendarBooking>>) {
  return {
    ok: true as const,
    data: {
      timeZone: 'Europe/Berlin',
      from: '2026-10-12',
      to: '2026-10-18',
      bookings,
      isTruncated: false,
      resources: [],
    },
  };
}

interface AdminOptions {
  readonly setup?: SetupFixture;
  readonly canConfigure?: boolean;
  readonly canManage?: boolean;
  /** Which part of the booking screen: the address says so in the app (`?tab=`). */
  readonly part?: 'calendar' | 'services';
}

function renderAdmin({
  setup: fixture = setupDto(),
  canConfigure = true,
  canManage = true,
  part = 'calendar',
}: AdminOptions = {}) {
  const options = {
    locations: fixture.locations.map(({ id, name, timeZone }) => ({ id, name, timeZone })),
    resources: fixture.resources.map(({ id, name, type, locationId, skills }) => ({
      id,
      name,
      type,
      locationId,
      skills,
    })),
    services: fixture.services.map(({ id, name, horizonDays }) => ({ id, name, horizonDays })),
    skills: [...new Set(fixture.resources.flatMap((resource) => resource.skills))],
    categories: [
      ...new Set(
        fixture.services.flatMap((service) => (service.category ? [service.category] : [])),
      ),
    ],
  };
  return renderBooking(
    part === 'calendar' ? (
      <OperationsCalendar websiteId="site-1" options={options} canManage={canManage} />
    ) : (
      <ServicesAtLocation
        services={fixture.services}
        options={options}
        canConfigure={canConfigure}
      />
    ),
  );
}

beforeEach(() => {
  loadCalendar.mockResolvedValue(calendarOf(calendarBooking()));
  const staffChange = {
    ok: true as const,
    data: { id: 'bk-1', status: 'cancelled' as const, rescheduleCount: 0 },
  };
  cancel.mockResolvedValue(staffChange as never);
  complete.mockResolvedValue({
    ...staffChange,
    data: { ...staffChange.data, status: 'completed' },
  } as never);
  noShow.mockResolvedValue({
    ...staffChange,
    data: { ...staffChange.data, status: 'no_show' },
  } as never);
  saveService.mockResolvedValue({ ok: true, data: serviceDto() });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('the operations calendar', () => {
  it('loads the visible range and shows the bookings at the location time', async () => {
    renderAdmin();

    expect(
      await screen.findByRole('button', { name: /Passport · Ada Lovelace 2026-10-12T10:00:00/ }),
    ).toBeInTheDocument();
    expect(loadCalendar).toHaveBeenCalledWith({
      websiteId: 'site-1',
      from: '2026-10-12',
      to: '2026-10-18',
    });
  });

  it('shows the details of a booking when it is selected', async () => {
    const user = setup();
    renderAdmin();
    await user.click(await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }));

    const panel = screen.getByRole('region', { name: 'Passport' });
    expect(within(panel).getByText('BK-ABCD-2345')).toBeInTheDocument();
    expect(within(panel).getByText('ada@example.org')).toBeInTheDocument();
    expect(within(panel).getByText('Desk 1')).toBeInTheDocument();
    expect(within(panel).getByText('Confirmed')).toBeInTheDocument();
  });

  it('cancels a booking after confirmation and reloads the calendar', async () => {
    const user = setup();
    renderAdmin();
    await user.click(await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }));

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(cancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel' }));

    expect(cancel).toHaveBeenCalledWith({ bookingId: 'bk-1' });
    await waitFor(() => {
      expect(loadCalendar).toHaveBeenCalledTimes(2);
    });
  });

  it('marks a booking as completed or as a no-show', async () => {
    const user = setup();
    renderAdmin();
    await user.click(await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }));

    await user.click(screen.getByRole('button', { name: 'Mark as completed' }));
    expect(complete).toHaveBeenCalledWith({ bookingId: 'bk-1' });

    await user.click(await screen.findByRole('button', { name: 'Mark as no-show' }));
    expect(noShow).toHaveBeenCalledWith({ bookingId: 'bk-1' });
  });

  it('offers no actions to a person who may only read', async () => {
    const user = setup();
    renderAdmin({ canManage: false });
    await user.click(await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }));

    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.getByText('You can view bookings but not change them.')).toBeInTheDocument();
  });

  it('offers no actions on a booking that has already ended', async () => {
    const user = setup();
    loadCalendar.mockResolvedValue(
      calendarOf(calendarBooking({ status: 'cancelled', cancelledBy: 'customer' })),
    );
    renderAdmin();
    await user.click(await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }));

    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.getByText('Cancelled by')).toBeInTheDocument();
    expect(screen.getByText('Cancelled by').nextElementSibling).toHaveTextContent('Customer');
  });

  it('shows the server error and lets staff retry', async () => {
    const user = setup();
    loadCalendar.mockResolvedValueOnce(failure('auth.permission_denied'));
    renderAdmin();

    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: /Passport · Ada Lovelace/ }),
    ).toBeInTheDocument();
  });

  it('says what to do when there is no location yet', async () => {
    renderAdmin({ setup: setupDto({ locations: [] }) });
    expect(screen.getByText('Add a location under Setup to see the calendar.')).toBeInTheDocument();
    expect(loadCalendar).not.toHaveBeenCalled();
  });
});

describe('the administration lists', () => {
  it('lists services with their length and number of locations', () => {
    renderAdmin({ part: 'services' });

    expect(screen.getByRole('button', { name: /Edit Passport/ })).toBeInTheDocument();
  });
});

describe('the service form', () => {
  async function openNewService(user: ReturnType<typeof setup>) {
    renderAdmin({ setup: setupDto({ services: [] }), part: 'services' });
    await user.click(await screen.findByRole('button', { name: 'New service' }));
  }

  it('does not save a service without a name', async () => {
    const user = setup();
    await openNewService(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saveService).not.toHaveBeenCalled();
    expect((await screen.findAllByText('Please enter a name.')).length).toBeGreaterThan(0);
  });

  it('saves the service with the rules the editor chose', async () => {
    const user = setup();
    await openNewService(user);
    await user.type(screen.getByLabelText('Name'), '  Residence registration ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledTimes(1);
    });
    const payload = saveService.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      websiteId: 'site-1',
      name: 'Residence registration',
      isActive: true,
      durationMinutes: 30,
      slotIntervalMinutes: 15,
      locationIds: ['loc-berlin'],
      participantsPerBooking: 1,
      cancellation: expect.objectContaining({ isAllowed: true }),
    });
    expect(payload).not.toHaveProperty('id');
    // The action revalidates the page, so its response already carries the fresh data: no second round trip.
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
  });

  it('shows what the server rejected next to the form', async () => {
    const user = setup();
    saveService.mockResolvedValueOnce(
      failure('booking.validation_failed', { name: ['booking.validation.name_required'] }),
    );
    await openNewService(user);
    await user.type(screen.getByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Please enter a name.')).length).toBeGreaterThan(0);
    // The draft is kept: nothing typed is lost on failure.
    expect(screen.getByLabelText('Name')).toHaveValue('x');
  });

  it('opens an existing service for editing and keeps its id', async () => {
    const user = setup();
    renderAdmin({ part: 'services' });
    await user.click(await screen.findByRole('button', { name: /Edit Passport/ }));
    expect(screen.getByLabelText('Name')).toHaveValue('Passport');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(saveService).toHaveBeenCalled();
    });
    expect(saveService.mock.calls[0]?.[0]).toMatchObject({ id: 'svc-passport', name: 'Passport' });
  });
});

describe('who may configure', () => {
  it('hides the buttons that change things from a person who may only manage bookings', async () => {
    renderAdmin({ canConfigure: false, part: 'services' });
    expect(await screen.findByText('Passport')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.getByText('You can view this but not change it.')).toBeInTheDocument();
  });

  it('flags services that are switched off', async () => {
    renderAdmin({
      setup: setupDto({
        services: [serviceDto({ isActive: false })],
        resources: [resourceDto({ isActive: false })],
        locations: [locationDto({ isActive: false })],
      }),
      part: 'services',
    });
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
  });
});
