import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BookingCatalogDto, PublicBookingDto } from '@modules/booking/client';
import { PublicBooking } from '@modules/booking/presentation/components/public/public-booking.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

import { expectNoViolations } from '../../../support/a11y';

const mocks = vi.hoisted(() => ({
  slots: vi.fn(),
  ownSlots: vi.fn(),
  hold: vi.fn(),
  confirm: vi.fn(),
  release: vi.fn(),
  find: vi.fn(),
  cancel: vi.fn(),
  reschedule: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/get-available-slots-action', () => ({
  getAvailableSlotsAction: mocks.slots,
}));
vi.mock('@modules/booking/presentation/actions/get-own-booking-slots-action', () => ({
  getOwnBookingSlotsAction: mocks.ownSlots,
}));
vi.mock('@modules/booking/presentation/actions/hold-slot-action', () => ({
  holdSlotAction: mocks.hold,
}));
vi.mock('@modules/booking/presentation/actions/confirm-booking-action', () => ({
  confirmBookingAction: mocks.confirm,
}));
vi.mock('@modules/booking/presentation/actions/release-hold-action', () => ({
  releaseHoldAction: mocks.release,
}));
vi.mock('@modules/booking/presentation/actions/find-booking-action', () => ({
  findBookingAction: mocks.find,
}));
vi.mock('@modules/booking/presentation/actions/cancel-own-booking-action', () => ({
  cancelOwnBookingAction: mocks.cancel,
}));
vi.mock('@modules/booking/presentation/actions/reschedule-own-booking-action', () => ({
  rescheduleOwnBookingAction: mocks.reschedule,
}));

const ZONE = 'Europe/Berlin';
const RULE = { isAllowed: true, deadlineMinutes: 1440 };
const CATALOG: BookingCatalogDto = {
  isTruncated: false,
  services: [
    {
      id: 'svc-pass',
      name: 'Passport',
      description: 'A new passport',
      category: null,
      instructions: null,
      requiredDocuments: ['Photo'],
      durationMinutes: 30,
      horizonDays: 30,
      information: [
        { field: 'firstName', isRequired: false },
        { field: 'email', isRequired: true },
      ],
      cancellation: RULE,
      rescheduling: RULE,
      locationIds: ['loc-west', 'loc-east'],
    },
  ],
  locations: [
    {
      id: 'loc-west',
      name: 'Town hall West',
      address: 'Market 1',
      timeZone: ZONE,
      today: '2027-01-10',
    },
    { id: 'loc-east', name: 'Town hall East', address: null, timeZone: ZONE, today: '2027-01-10' },
  ],
};
const SLOT = { start: '2027-01-12T09:00:00+01:00', end: '2027-01-12T09:30:00+01:00' };
const LATER = { start: '2027-01-12T10:00:00+01:00', end: '2027-01-12T10:30:00+01:00' };

function bookingOf(status: PublicBookingDto['status'], slot = SLOT): PublicBookingDto {
  return {
    websiteId: 'site',
    id: 'bk-1',
    reference: '7KQ2M9XB4C',
    status,
    serviceId: 'svc-pass',
    serviceName: 'Passport',
    locationId: 'loc-west',
    locationName: 'Town hall West',
    locationAddress: 'Market 1',
    timeZone: ZONE,
    ...slot,
    holdExpiresAt: status === 'held' ? '2027-01-10T12:10:00+01:00' : null,
    rescheduleCount: 0,
    cancellation: { isAllowed: status === 'confirmed', until: '2027-01-11T09:00:00+01:00' },
    rescheduling: { isAllowed: status === 'confirmed', until: '2027-01-11T09:00:00+01:00' },
  };
}

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const refused = (code: string) =>
  Promise.resolve({ ok: false as const, error: { code, message: code } });

function renderBooking(isPreview = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ app: enApp, ...enBooking }} timeZone={ZONE}>
      <PublicBooking websiteId="site" catalog={CATALOG} initialMonth={null} isPreview={isPreview} />
    </NextIntlClientProvider>,
  );
}

/** Presses a control the way a keyboard does: it must be reachable, then Enter activates it. */
async function press(name: string | RegExp) {
  const control = await screen.findByRole('button', { name });
  await waitFor(() => {
    expect(control).toBeEnabled();
  });
  control.focus();
  expect(control).toHaveFocus();
  fireEvent.click(control);
}

async function reachTimes(isPreview = false) {
  renderBooking(isPreview);
  await press('Town hall West');
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'On which day?' })).toHaveFocus();
  });
  await press(/Tuesday, January 12, 2027, appointments free/);
  await screen.findByRole('button', { name: /^09:00/ });
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  const freeTimes = ({ from }: { from: string }) =>
    ok({
      timeZone: ZONE,
      slots: from === '2027-01-12' ? [SLOT, LATER] : [SLOT],
      isTruncated: false,
    });
  mocks.slots.mockImplementation(freeTimes);
  mocks.ownSlots.mockImplementation(freeTimes);
  mocks.release.mockReturnValue(ok(bookingOf('cancelled')));
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('the booking journey in the editor preview', () => {
  it('can be walked through to the end, but reserves and books nothing', async () => {
    await reachTimes(true);
    expect(
      screen.getByText(
        'Preview: you can walk through the booking, but nothing is reserved or saved.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My booking' })).not.toBeInTheDocument();

    await press(/^09:00/);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your details' })).toHaveFocus();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const email = await screen.findByRole('textbox', { name: 'E-mail address' });
    fireEvent.change(email, { target: { value: 'mira@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Please review your booking' });
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));

    await screen.findByRole('heading', { name: 'Your appointment is booked' });
    expect(mocks.hold).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });
});

describe('the booking journey', () => {
  it('walks from the place to the booking by keyboard, reading only what is on screen', async () => {
    await reachTimes();
    // What and where stay in view while the day and time are picked.
    const chosen = screen.getByLabelText('Your booking');
    expect(chosen).toHaveTextContent('Town hall West, Market 1');
    expect(mocks.slots).toHaveBeenNthCalledWith(1, {
      websiteId: 'site',
      serviceId: 'svc-pass',
      locationId: 'loc-west',
      from: '2027-01-10',
      to: '2027-01-31',
    });
    expect(mocks.slots).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2027-01-12', to: '2027-01-12' }),
    );

    mocks.hold.mockReturnValue(ok(bookingOf('held')));
    await press(/^09:00/);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your details' })).toHaveFocus();
    });
    expect(mocks.hold).toHaveBeenCalledWith({
      websiteId: 'site',
      serviceId: 'svc-pass',
      locationId: 'loc-west',
      start: SLOT.start,
      locale: 'en',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const bookingPanel = within(screen.getByRole('tabpanel', { name: 'Book an appointment' }));
    const email = await bookingPanel.findByRole('textbox', { name: 'E-mail address' });
    expect(email).toHaveFocus();
    fireEvent.change(email, { target: { value: 'mira@example.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Please review your booking' })).toHaveFocus();
    });
    expect(
      screen.getByText('This time is reserved for you for a few minutes.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Please bring: Photo')).toBeInTheDocument();
    await expectNoViolations(document.body);

    mocks.confirm.mockReturnValue(ok(bookingOf('confirmed')));
    const book = screen.getByRole('button', { name: 'Book now' });
    fireEvent.click(book);
    fireEvent.click(book);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your appointment is booked' })).toHaveFocus();
    });
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledWith({
      websiteId: 'site',
      bookingId: 'bk-1',
      customer: { firstName: '', email: 'mira@example.org' },
    });
    expect(screen.getByText('7KQ2M9XB4C')).toBeInTheDocument();
    expect(screen.getByText(/You can cancel online until/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View, move or cancel the booking' })).toHaveAttribute(
      'href',
      '?manage=7KQ2M9XB4C#booking',
    );
    await expectNoViolations(document.body);
  });

  it('brings the visitor back to the free times when theirs was taken, and keeps what they typed', async () => {
    await reachTimes();
    mocks.hold.mockReturnValueOnce(ok(bookingOf('held')));
    await press(/^09:00/);
    const bookingPanel = within(screen.getByRole('tabpanel', { name: 'Book an appointment' }));
    await bookingPanel.findByRole('textbox', { name: 'E-mail address' });
    fireEvent.change(bookingPanel.getByRole('textbox', { name: 'E-mail address' }), {
      target: { value: 'mira@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: 'Book now' });

    mocks.confirm.mockReturnValue(refused('booking.expired'));
    mocks.slots.mockImplementation(() =>
      ok({ timeZone: ZONE, slots: [LATER], isTruncated: false }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The reservation has run out');
    await screen.findByRole('button', { name: /^10:00/ });
    expect(screen.queryByRole('button', { name: /^09:00/ })).not.toBeInTheDocument();

    mocks.hold.mockReturnValueOnce(refused('booking.slot_unavailable'));
    await press(/^10:00/);
    expect(await screen.findByRole('alert')).toHaveTextContent('This time was just taken');
    expect(screen.getByRole('heading', { name: 'At what time?' })).toBeInTheDocument();

    mocks.hold.mockReturnValueOnce(ok(bookingOf('held', LATER)));
    await press(/^10:00/);
    expect(await bookingPanel.findByRole('textbox', { name: 'E-mail address' })).toHaveValue(
      'mira@example.org',
    );
    await expectNoViolations(document.body);
  });
});

describe('my booking', () => {
  it('opens with the number of the link filled in, and answers a wrong address with "not found"', async () => {
    window.history.replaceState(null, '', '/?manage=7KQ2M9XB4C');
    mocks.find.mockReturnValue(refused('booking.not_found'));
    renderBooking();

    expect(screen.getByRole('tab', { name: 'My booking' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByRole('textbox', { name: 'Booking number' })).toHaveValue(
      '7KQ2M9XB4C',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'E-mail address' }), {
      target: { value: 'wrong@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show booking' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The booking was not found.');
    expect(mocks.find).toHaveBeenCalledWith({
      websiteId: 'site',
      reference: '7KQ2M9XB4C',
      email: 'wrong@example.org',
    });
    await expectNoViolations(document.body);
  });

  it('cancels after asking, with the number and the address again', async () => {
    window.history.replaceState(null, '', '/?manage=7KQ2M9XB4C');
    mocks.find.mockReturnValue(ok(bookingOf('confirmed')));
    mocks.cancel.mockReturnValue(ok(bookingOf('cancelled')));
    renderBooking();
    fireEvent.change(await screen.findByRole('textbox', { name: 'E-mail address' }), {
      target: { value: 'mira@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show booking' }));
    await screen.findByRole('button', { name: 'Cancel appointment' });
    await press('Cancel appointment');

    const dialog = await screen.findByRole('alertdialog', { name: 'Cancel the appointment?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));

    expect(await screen.findByText(/The appointment is cancelled/)).toBeInTheDocument();
    // The closing dialog still holds focus for a moment, and under load for longer.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your booking' })).toHaveFocus();
    });
    expect(mocks.cancel).toHaveBeenCalledWith({
      websiteId: 'site',
      reference: '7KQ2M9XB4C',
      email: 'mira@example.org',
    });
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Move appointment' })).not.toBeInTheDocument();
  });

  it('focuses the booking number only when returning to look up another booking', async () => {
    window.history.replaceState(null, '', '/?manage=7KQ2M9XB4C');
    mocks.find.mockReturnValue(ok(bookingOf('confirmed')));
    renderBooking();

    const reference = await screen.findByRole('textbox', { name: 'Booking number' });
    expect(reference).toHaveValue('7KQ2M9XB4C');
    expect(reference).not.toHaveFocus();
    fireEvent.change(screen.getByRole('textbox', { name: 'E-mail address' }), {
      target: { value: 'mira@example.org' },
    });
    await press('Show booking');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your booking' })).toHaveFocus();
    });

    await press('Show another booking');
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Booking number' })).toHaveFocus();
    });
    expect(screen.getByRole('textbox', { name: 'Booking number' })).toHaveValue('7KQ2M9XB4C');
    expect(screen.getByRole('textbox', { name: 'E-mail address' })).toHaveValue('');
  });

  it('moves to a free time of the same service and place', async () => {
    window.history.replaceState(null, '', '/?manage=7KQ2M9XB4C');
    mocks.find.mockReturnValue(ok(bookingOf('confirmed')));
    mocks.reschedule.mockReturnValue(ok(bookingOf('confirmed', LATER)));
    renderBooking();
    fireEvent.change(await screen.findByRole('textbox', { name: 'E-mail address' }), {
      target: { value: 'mira@example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show booking' }));
    await screen.findByRole('button', { name: 'Move appointment' });
    await press('Move appointment');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a new time' })).toHaveFocus();
    });
    await press('Keep appointment');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your booking' })).toHaveFocus();
    });
    expect(screen.queryByRole('heading', { name: 'Choose a new time' })).not.toBeInTheDocument();

    await press('Move appointment');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Choose a new time' })).toHaveFocus();
    });
    await screen.findByRole('button', { name: /Tuesday, January 12, 2027, appointments free/ });
    await press(/Tuesday, January 12/);
    await screen.findByRole('button', { name: /^10:00/ });
    expect(screen.getByRole('button', { name: /Tuesday, January 12/ })).toHaveFocus();
    await press(/^10:00/);
    await press(/^Move to/);

    expect(await screen.findByText(/The appointment is moved/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your booking' })).toHaveFocus();
    });
    // The times come from the move's own question, never the public catalog's.
    expect(mocks.ownSlots).toHaveBeenCalledWith(
      expect.objectContaining({ reference: '7KQ2M9XB4C', email: 'mira@example.org' }),
    );
    expect(mocks.slots).not.toHaveBeenCalled();
    expect(mocks.reschedule).toHaveBeenCalledWith({
      websiteId: 'site',
      reference: '7KQ2M9XB4C',
      email: 'mira@example.org',
      start: LATER.start,
    });
    await expectNoViolations(document.body);
  });
});
