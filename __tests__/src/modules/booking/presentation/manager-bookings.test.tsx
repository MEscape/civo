import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssignmentCandidatesDto, BookingDto } from '@modules/booking/client';
import { BookingPanel } from '@modules/booking/presentation/components/bookings/booking-panel.client';
import { BookingRows } from '@modules/booking/presentation/components/bookings/booking-rows.client';
import { CalendarEventDetails } from '@modules/booking/presentation/components/calendar/calendar-event-details.client';
import type {
  BookingDetailDto,
  BookingNamesDto,
} from '@modules/booking/presentation/dto/booking-dto';
import { nameBookOf } from '@modules/booking/presentation/forms/booking-names';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  candidates: vi.fn(),
  assign: vi.fn(),
  unassign: vi.fn(),
}));

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/get-assignment-candidates-action', () => ({
  getAssignmentCandidatesAction: mocks.candidates,
}));
vi.mock('@modules/booking/presentation/actions/assign-employee-action', () => ({
  assignEmployeeAction: mocks.assign,
}));
vi.mock('@modules/booking/presentation/actions/unassign-employee-action', () => ({
  unassignEmployeeAction: mocks.unassign,
}));

const NAMES: BookingNamesDto = {
  isServicesTruncated: false,
  locations: [
    { id: 'loc-west', name: 'Bürgerbüro West', timeZone: 'Europe/Berlin', today: '2027-01-12' },
  ],
  services: [{ id: 'svc-pass', name: 'Passport' }],
  resources: [
    { id: 'res-markus', name: 'Markus Schmidt', type: 'employee' },
    { id: 'res-lisa', name: 'Lisa Hoffmann', type: 'employee' },
    { id: 'res-anna', name: 'Anna Weber', type: 'employee' },
  ],
};

const BOOKING: BookingDto = {
  websiteId: 'site-1',
  id: 'b-1',
  reference: '7KQ3M9XD2P',
  status: 'confirmed',
  serviceId: 'svc-pass',
  locationId: 'loc-west',
  timeZone: 'Europe/Berlin',
  start: '2027-01-12T09:00:00+01:00',
  end: '2027-01-12T09:45:00+01:00',
  units: [{ requirementIndex: 0, resourceType: 'employee', resourceId: null }],
  assignment: 'open',
  customer: { firstName: 'Julia', lastName: 'Becker', email: 'j.becker@example.org' },
  holdExpiresAt: null,
  rescheduleCount: 0,
  cancelledAt: null,
  createdAt: '2027-01-10T18:12:00+01:00',
};

const CANDIDATES: AssignmentCandidatesDto = {
  requirementIndex: 0,
  eligible: [
    {
      resourceId: 'res-markus',
      fit: {
        level: 'very-good',
        reasons: ['service-preferred', 'time-in-window'],
      },
    },
    { resourceId: 'res-lisa', fit: { level: 'possible', reasons: ['time-outside-window'] } },
  ],
  unavailable: [
    {
      resourceId: 'res-anna',
      reasons: [
        {
          code: 'time-conflict',
          with: {
            start: Date.parse('2027-01-12T08:15:00Z'),
            end: Date.parse('2027-01-12T09:00:00Z'),
          },
        },
      ],
    },
  ],
} as unknown as AssignmentCandidatesDto;

const withMessages = (node: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
    {node}
  </NextIntlClientProvider>
);

const DETAIL: BookingDetailDto = {
  ...BOOKING,
  staffChanges: { mayReplace: true, mayRemove: true },
};

const renderPanel = (mayManage = true, booking = DETAIL) =>
  render(
    withMessages(
      <BookingPanel booking={booking} names={NAMES} mayManage={mayManage} closeHref="/list" />,
    ),
  );

const openAssign = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Assign employee' }));
  const dialog = await screen.findByRole('dialog', { name: 'Assign employee' });
  await within(dialog).findByRole('radiogroup');
  return dialog;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.candidates.mockResolvedValue({ ok: true, data: CANDIDATES });
  mocks.assign.mockResolvedValue({ ok: true, data: BOOKING });
});

describe('the side panel of a booking', () => {
  it('shows what was booked on the location clock and the citizen only here', async () => {
    const { container } = renderPanel();

    // A dialog over the list, so the table behind keeps its whole width.
    const panel = screen.getByRole('dialog', { name: 'Passport' });
    // The subtitle, repeated in the dialogs that name the booking.
    expect(within(panel).getAllByText(/09:00.*09:45.* · Bürgerbüro West/)[0]).toBeVisible();
    expect(within(panel).getByText('Becker, Julia')).toBeInTheDocument();
    expect(within(panel).getByText('j.becker@example.org')).toBeInTheDocument();
    expect(within(panel).getByText('Nobody assigned yet')).toBeInTheDocument();
    // One place for the booking's own actions, the staff change beside the place it changes.
    expect(within(panel).getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Assign employee' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('keeps the actions of the booking behind one menu: move, record, cancel', async () => {
    renderPanel();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions' }), {
      button: 0,
      ctrlKey: false,
    });

    for (const name of ['Reschedule', 'Mark completed', 'Mark no-show', 'Cancel booking']) {
      expect(await screen.findByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('offers no action to someone who may only read', () => {
    renderPanel(false);
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign employee' })).not.toBeInTheDocument();
  });

  it('offers no menu for a booking that is over and cannot be changed any more', () => {
    renderPanel(true, { ...DETAIL, status: 'completed' });
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });

  const assignedTo = (staffChanges: BookingDetailDto['staffChanges']): BookingDetailDto => ({
    ...DETAIL,
    assignment: 'assigned',
    units: [{ requirementIndex: 0, resourceType: 'employee', resourceId: 'res-lisa' }],
    staffChanges,
  });

  it('offers replacing and removing each assigned employee', () => {
    renderPanel(true, assignedTo({ mayReplace: true, mayRemove: true }));
    expect(screen.getByRole('button', { name: 'Replace Lisa Hoffmann' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Lisa Hoffmann' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign employee' })).not.toBeInTheDocument();
  });

  it('offers only replacing where the place may not be left open (assigned at booking time)', async () => {
    const { container } = renderPanel(true, assignedTo({ mayReplace: true, mayRemove: false }));
    expect(screen.getByRole('button', { name: 'Replace Lisa Hoffmann' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Lisa Hoffmann' })).not.toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('offers no change of the employee once the booking has begun', () => {
    renderPanel(true, assignedTo({ mayReplace: false, mayRemove: false }));
    expect(screen.queryByRole('button', { name: 'Replace Lisa Hoffmann' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Lisa Hoffmann' })).not.toBeInTheDocument();
  });
});

describe('the assignment dialog', () => {
  it('says that nothing was stated for somebody who has no preference to weigh', async () => {
    mocks.candidates.mockResolvedValue({
      ok: true,
      data: {
        ...CANDIDATES,
        eligible: [{ resourceId: 'res-markus', fit: { level: 'good', reasons: [] } }],
      },
    });
    renderPanel();
    const dialog = await openAssign();

    expect(within(dialog).getByText('No preference stated')).toBeInTheDocument();
  });

  it('recommends the good fits, lists everybody suitable and says why the others cannot', async () => {
    renderPanel();
    const dialog = await openAssign();

    expect(within(dialog).getByRole('tab', { name: 'Recommended 1' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'All suitable 2' })).toBeInTheDocument();
    const unavailable = within(dialog).getByRole('tab', { name: 'Unavailable 1' });
    expect(within(dialog).getByText('Very good fit')).toBeInTheDocument();
    // What each person's preferences say, in words: said, said against, or nothing said.
    expect(within(dialog).getByText('Prefers: this service, this time')).toBeInTheDocument();
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'All suitable 2' }));
    fireEvent.click(within(dialog).getByRole('tab', { name: 'All suitable 2' }));
    expect(await within(dialog).findByText('Not preferred: this time')).toBeInTheDocument();
    await expectNoViolations(dialog);

    fireEvent.mouseDown(unavailable, { button: 0 });
    expect(
      await within(dialog).findByText(/Overlaps another appointment: 09:15.*10:00/),
    ).toBeInTheDocument();
  });

  it('assigns the chosen employee to the open unit', async () => {
    renderPanel();
    const dialog = await openAssign();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Markus Schmidt/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign Markus Schmidt' }));

    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith({
        websiteId: 'site-1',
        bookingId: 'b-1',
        resourceId: 'res-markus',
        requirementIndex: 0,
        replaces: undefined,
      });
    });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
  });

  it('reads again and says so when somebody else took the booking first', async () => {
    mocks.assign.mockResolvedValue({
      ok: false,
      error: { code: 'booking.already_assigned', message: 'x' },
    });
    renderPanel();
    const dialog = await openAssign();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Markus Schmidt/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign Markus Schmidt' }));

    expect(await within(dialog).findByText(/changed in the meantime/)).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.candidates).toHaveBeenCalledTimes(2);
    });
  });
});

describe('the rows of the list', () => {
  it('names each booking and links to its details without colour alone', async () => {
    const { container } = render(
      withMessages(
        <BookingRows
          empty={null}
          items={[BOOKING]}
          names={NAMES}
          detailsHref={{ 'b-1': '/list?booking=b-1' }}
          selectedId={undefined}
          showsDate={false}
        />,
      ),
    );

    expect(screen.getByRole('link', { name: /^Details of Passport on 09:00/ })).toHaveAttribute(
      'href',
      '/list?booking=b-1',
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    await expectNoViolations(container);
  });
});

describe('a calendar entry', () => {
  it('shows the booking in short and leads to the assignment and the list', async () => {
    const onAssign = vi.fn();
    render(
      withMessages(
        <CalendarEventDetails
          booking={BOOKING}
          book={nameBookOf(NAMES, 'Unknown')}
          isOpen
          detailsHref="/list?booking=b-1"
          mayAssign
          onAssign={onAssign}
          onClose={vi.fn()}
        />,
      ),
    );

    const dialog = await screen.findByRole('dialog', { name: 'Passport' });
    expect(within(dialog).getByText('Citizen: Becker, Julia')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Open in the list' })).toHaveAttribute(
      'href',
      '/list?booking=b-1',
    );
    await expectNoViolations(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Assign employee' }));
    expect(onAssign).toHaveBeenCalled();
  });
});
