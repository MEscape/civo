import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cancelOwnBookingAction } from '@modules/booking/presentation/actions/cancel-own-booking-action';
import { findBookingAction } from '@modules/booking/presentation/actions/find-booking-action';
import { getAvailableSlotsAction } from '@modules/booking/presentation/actions/get-available-slots-action';
import { rescheduleOwnBookingAction } from '@modules/booking/presentation/actions/reschedule-own-booking-action';
import { ManageBooking } from '@modules/booking/presentation/components/flow/manage-booking.client';
import type { ManageBookingProps } from '@modules/booking/presentation/components/flow/manage-booking.client';

import { booking, service, slot } from './fixtures';
import { failure, renderBooking, setup } from './ui-support';

vi.mock('@modules/booking/presentation/actions/find-booking-action', () => ({
  findBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/cancel-own-booking-action', () => ({
  cancelOwnBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/reschedule-own-booking-action', () => ({
  rescheduleOwnBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/get-available-slots-action', () => ({
  getAvailableSlotsAction: vi.fn(),
}));

const find = vi.mocked(findBookingAction);
const cancel = vi.mocked(cancelOwnBookingAction);
const move = vi.mocked(rescheduleOwnBookingAction);
const slots = vi.mocked(getAvailableSlotsAction);

function renderManage(overrides: Partial<ManageBookingProps> = {}) {
  const onBack = vi.fn();
  renderBooking(
    <ManageBooking
      websiteId="site-1"
      services={[service()]}
      initial={null}
      readOnly={false}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { onBack };
}

async function lookUp(user: ReturnType<typeof setup>) {
  await user.type(screen.getByLabelText('Booking reference'), 'BK-ABCD-2345');
  await user.type(screen.getByLabelText('E-mail address'), 'ada@example.org');
  await user.click(screen.getByRole('button', { name: 'Find booking' }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T09:00:00Z'));
  find.mockResolvedValue({ ok: true, data: booking() });
  cancel.mockResolvedValue({ ok: true, data: booking({ status: 'cancelled', canCancel: false }) });
  move.mockResolvedValue({
    ok: true,
    data: booking({ localDate: '2026-10-14', localTime: '15:30', rescheduleCount: 1 }),
  });
  slots.mockResolvedValue({
    ok: true,
    data: {
      serviceId: 'svc-passport',
      locationId: 'loc-berlin',
      timeZone: 'Europe/Berlin',
      from: '2026-10-01',
      to: '2026-10-31',
      slots: [slot('2026-10-14', '15:30')],
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('finding a booking', () => {
  it('asks for both the reference and the e-mail address before looking anything up', async () => {
    const user = setup();
    renderManage();
    await user.click(screen.getByRole('button', { name: 'Find booking' }));
    expect(screen.getByText('Please enter your booking reference.')).toBeInTheDocument();
    expect(screen.getByText('Please enter the e-mail address of the booking.')).toBeInTheDocument();
    expect(find).not.toHaveBeenCalled();
  });

  it('shows the booking once both match', async () => {
    const user = setup();
    renderManage();
    await lookUp(user);

    expect(find).toHaveBeenCalledWith({
      websiteId: 'site-1',
      reference: 'BK-ABCD-2345',
      email: 'ada@example.org',
    });
    expect(await screen.findByText('BK-ABCD-2345')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeEnabled();
  });

  it('answers a wrong e-mail address exactly like an unknown reference', async () => {
    const user = setup();
    find.mockResolvedValue(failure('booking.not_found'));
    renderManage();
    await lookUp(user);
    expect(
      await screen.findByText(/We could not find a booking with this reference and e-mail address/),
    ).toBeInTheDocument();
    // Nothing about the booking leaks.
    expect(screen.queryByText('BK-ABCD-2345')).not.toBeInTheDocument();
  });

  it('tells a visitor who is being rate limited to wait', async () => {
    const user = setup();
    find.mockResolvedValue(failure('booking.rate_limited'));
    renderManage();
    await lookUp(user);
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
  });

  it('skips the lookup for a booking that was just made', () => {
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });
    expect(screen.getByText('BK-ABCD-2345')).toBeInTheDocument();
    expect(find).not.toHaveBeenCalled();
  });
});

describe('cancelling', () => {
  it('asks to confirm, then cancels with the proof of ownership', async () => {
    const user = setup();
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });

    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    const dialog = screen.getByRole('alertdialog');
    expect(
      within(dialog).getByText('Do you really want to cancel this booking?'),
    ).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Yes, cancel booking' }));
    expect(cancel).toHaveBeenCalledWith({
      websiteId: 'site-1',
      reference: 'BK-ABCD-2345',
      email: 'ada@example.org',
    });
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('This booking is no longer active.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
  });

  it('keeps the booking when the visitor changes their mind', async () => {
    const user = setup();
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Keep booking' }));
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('explains when the deadline has passed', async () => {
    const user = setup();
    cancel.mockResolvedValue(failure('booking.cancellation_deadline_passed'));
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });
    await user.click(screen.getByRole('button', { name: 'Cancel booking' }));
    await user.click(screen.getByRole('button', { name: 'Yes, cancel booking' }));
    expect(
      await screen.findByText(/The deadline for cancelling this booking online has passed/),
    ).toBeInTheDocument();
  });

  it('disables what the rules no longer allow and says why', () => {
    renderManage({
      initial: { booking: booking({ canCancel: false, canReschedule: false }), email: 'a@b.de' },
    });
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move to another time' })).toBeDisabled();
    expect(screen.getByText(/no longer possible online/)).toBeInTheDocument();
  });

  it('cannot change anything in the editor preview', () => {
    renderManage({
      readOnly: true,
      initial: { booking: booking(), email: 'ada@example.org' },
    });
    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeDisabled();
  });
});

describe('moving to another time', () => {
  it('lets the visitor pick a new time and sends the chosen start', async () => {
    const user = setup();
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });

    await user.click(screen.getByRole('button', { name: 'Move to another time' }));
    await user.click(await screen.findByRole('button', { name: /October 14, 2026/ }));
    await user.click(await screen.findByRole('radio', { name: /3:30/ }));
    await user.click(screen.getByRole('button', { name: /^Move to/ }));

    expect(move).toHaveBeenCalledWith({
      websiteId: 'site-1',
      reference: 'BK-ABCD-2345',
      email: 'ada@example.org',
      start: '2026-10-14T15:30:00.000Z',
    });
    expect(await screen.findByText(/Marktplatz 1/)).toBeInTheDocument();
  });

  it('shows the rule that stopped a move', async () => {
    const user = setup();
    move.mockResolvedValue(failure('booking.rescheduling_deadline_passed'));
    renderManage({ initial: { booking: booking(), email: 'ada@example.org' } });
    await user.click(screen.getByRole('button', { name: 'Move to another time' }));
    await user.click(await screen.findByRole('button', { name: /October 14, 2026/ }));
    await user.click(await screen.findByRole('radio', { name: /3:30/ }));
    await user.click(screen.getByRole('button', { name: /^Move to/ }));
    expect(
      await screen.findByText(/The deadline for moving this booking online has passed/),
    ).toBeInTheDocument();
  });
});

describe('leaving', () => {
  it('goes back to booking', async () => {
    const user = setup();
    const { onBack } = renderManage({ initial: { booking: booking(), email: 'a@b.de' } });
    await user.click(screen.getByRole('button', { name: 'Back to booking' }));
    expect(onBack).toHaveBeenCalled();
  });
});
