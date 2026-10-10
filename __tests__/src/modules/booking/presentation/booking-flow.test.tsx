import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmBookingAction } from '@modules/booking/presentation/actions/confirm-booking-action';
import { getAvailableSlotsAction } from '@modules/booking/presentation/actions/get-available-slots-action';
import { holdSlotAction } from '@modules/booking/presentation/actions/hold-slot-action';
import { releaseHoldAction } from '@modules/booking/presentation/actions/release-hold-action';
import { suggestAlternativeSlotsAction } from '@modules/booking/presentation/actions/suggest-alternative-slots-action';
import { BookingFlow } from '@modules/booking/presentation/components/flow/booking-flow.client';
import type { BookingFlowProps } from '@modules/booking/presentation/components/flow/booking-flow.client';

import { ANNEX, BERLIN, COURSE, booking, catalog, hold, service, slot } from './fixtures';
import { failure, renderBooking, setup } from './ui-support';

import type { User } from './ui-support';

vi.mock('@modules/booking/presentation/actions/get-available-slots-action', () => ({
  getAvailableSlotsAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/suggest-alternative-slots-action', () => ({
  suggestAlternativeSlotsAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/hold-slot-action', () => ({
  holdSlotAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/release-hold-action', () => ({
  releaseHoldAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/confirm-booking-action', () => ({
  confirmBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/find-booking-action', () => ({
  findBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/cancel-own-booking-action', () => ({
  cancelOwnBookingAction: vi.fn(),
}));
vi.mock('@modules/booking/presentation/actions/reschedule-own-booking-action', () => ({
  rescheduleOwnBookingAction: vi.fn(),
}));

const slots = vi.mocked(getAvailableSlotsAction);
const alternatives = vi.mocked(suggestAlternativeSlotsAction);
const holdSlot = vi.mocked(holdSlotAction);
const release = vi.mocked(releaseHoldAction);
const confirm = vi.mocked(confirmBookingAction);

const TEN = slot('2026-10-12', '10:00');
const ELEVEN = slot('2026-10-12', '11:00');
const AFTERNOON = slot('2026-10-14', '15:30');

function availability(...list: Array<ReturnType<typeof slot>>) {
  return {
    ok: true as const,
    data: {
      serviceId: 'svc-passport',
      locationId: 'loc-berlin',
      timeZone: 'Europe/Berlin',
      from: '2026-10-01',
      to: '2026-10-31',
      slots: list,
    },
  };
}

function renderFlow(overrides: Partial<BookingFlowProps> = {}) {
  return renderBooking(
    <BookingFlow
      websiteId="site-1"
      catalog={catalog(service())}
      fixedServiceId={null}
      heading="Book an appointment"
      readOnly={false}
      {...overrides}
    />,
  );
}

/** The summary of problems above the form (each field also announces its own message). */
async function errorSummary(): Promise<HTMLElement> {
  const heading = await screen.findByText('Please correct the following:');
  const summary = heading.closest<HTMLElement>('[role="alert"]');
  expect(summary).not.toBeNull();
  return summary!;
}

async function pickTime(user: User, day: RegExp, time: RegExp) {
  await user.click(await screen.findByRole('button', { name: day }));
  await user.click(await screen.findByRole('radio', { name: time }));
}

async function reachDetails(user: User) {
  await pickTime(user, /October 12, 2026/, /10:00/);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'Your details' });
}

async function fillDetails(user: User) {
  await user.type(screen.getByLabelText(/First name/), 'Ada');
  await user.type(screen.getByLabelText(/Last name/), 'Lovelace');
  await user.type(screen.getByLabelText(/E-mail address/), 'ada@example.org');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T09:00:00Z'));
  slots.mockResolvedValue(availability(TEN, ELEVEN, AFTERNOON));
  holdSlot.mockResolvedValue({ ok: true, data: hold() });
  release.mockResolvedValue({ ok: true, data: { released: true } });
  alternatives.mockResolvedValue({ ok: true, data: { timeZone: 'Europe/Berlin', slots: [] } });
  confirm.mockResolvedValue({ ok: true, data: booking() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('the public booking flow', () => {
  it('books a single service in a few steps and shows the reference', async () => {
    const user = setup();
    renderFlow();

    // One service, one location, one person: the flow starts at the time.
    expect(await screen.findByRole('heading', { name: 'Date and time' })).toBeInTheDocument();
    expect(screen.getByText(/All times are local time \(Europe\/Berlin\)/)).toBeInTheDocument();

    await reachDetails(user);
    expect(holdSlot).toHaveBeenCalledWith({
      websiteId: 'site-1',
      serviceId: 'svc-passport',
      locationId: 'loc-berlin',
      start: TEN.start,
      participants: 1,
    });
    expect(screen.getByText('Please arrive five minutes early.')).toBeInTheDocument();
    expect(screen.getByText('Photo ID')).toBeInTheDocument();

    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Review booking' }));

    const review = await screen.findByRole('heading', { name: 'Review' });
    expect(review).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Book now' }));

    expect(await screen.findByText('BK-ABCD-2345')).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledWith({
      websiteId: 'site-1',
      holdId: 'hold-1',
      customer: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org' },
    });
    // The module sends no e-mail, so it must not claim to.
    expect(screen.getByText(/We do not send a confirmation e-mail/)).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.org/)).toBeInTheDocument();
  });

  it('asks for the service, location and group size only when there is a real choice', async () => {
    const user = setup();
    renderFlow({ catalog: catalog(service(), COURSE) });

    expect(screen.getByRole('heading', { name: 'Service' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Swimming course/ }));

    expect(screen.getByRole('heading', { name: 'Location' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: new RegExp(ANNEX.name) }));

    expect(screen.getByRole('heading', { name: 'Group size' })).toBeInTheDocument();
    const people = screen.getByLabelText('Number of people');
    await user.clear(people);
    await user.type(people, '9');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Please enter a number between 1 and 4.')).toBeInTheDocument();

    await user.clear(people);
    await user.type(people, '3');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Date and time' })).toBeInTheDocument();
    await waitFor(() => {
      expect(slots).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: ANNEX.id,
          serviceId: COURSE.id,
          participants: 3,
        }),
      );
    });
  });

  it('offers only days that have free times', async () => {
    renderFlow();
    const free = await screen.findByRole('button', { name: /October 12, 2026/ });
    expect(free).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /October 13, 2026, no times available/ }),
    ).toBeDisabled();
  });

  it('groups the times of a day by morning and afternoon', async () => {
    const user = setup();
    slots.mockResolvedValue(availability(TEN, slot('2026-10-12', '15:30')));
    renderFlow();
    await user.click(await screen.findByRole('button', { name: /October 12, 2026/ }));
    expect(await screen.findByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Afternoon')).toBeInTheDocument();
  });

  it('does not let the visitor continue without choosing a time', async () => {
    renderFlow();
    await screen.findByRole('button', { name: /October 12, 2026/ });
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  });
});

describe('details', () => {
  it('shows a summary of problems and does not confirm anything', async () => {
    const user = setup();
    renderFlow();
    await reachDetails(user);

    await user.type(screen.getByLabelText(/E-mail address/), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Review booking' }));

    const summary = await errorSummary();
    expect(within(summary).getByText(/Please enter a valid e-mail address/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Review' })).not.toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('gives the reserved time back when the visitor goes back', async () => {
    const user = setup();
    renderFlow();
    await reachDetails(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(release).toHaveBeenCalledWith({ websiteId: 'site-1', holdId: 'hold-1' });
    expect(await screen.findByRole('heading', { name: 'Date and time' })).toBeInTheDocument();
  });

  it('keeps what the visitor typed when the server rejects a field', async () => {
    const user = setup();
    confirm.mockResolvedValueOnce(
      failure('booking.validation_failed', { email: ['booking.validation.email_invalid'] }),
    );
    renderFlow();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Review booking' }));
    await user.click(await screen.findByRole('button', { name: 'Book now' }));

    const summary = await errorSummary();
    expect(within(summary).getByText(/valid e-mail address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Ada');
  });
});

describe('two visitors, one time', () => {
  it('tells the second visitor the time is gone and offers the nearest other times', async () => {
    const user = setup();
    holdSlot.mockResolvedValueOnce(failure('booking.conflict'));
    alternatives.mockResolvedValueOnce({
      ok: true,
      data: { timeZone: 'Europe/Berlin', slots: [ELEVEN] },
    });
    renderFlow();

    await pickTime(user, /October 12, 2026/, /10:00/);
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText(
        'Someone else booked this time a moment ago. Please choose another time.',
      ),
    ).toBeInTheDocument();
    const offered = await screen.findByRole('button', { name: /11:00/ });
    expect(alternatives).toHaveBeenCalledWith(
      expect.objectContaining({ start: TEN.start, websiteId: 'site-1' }),
    );
    // The taken time is no longer a choice.
    expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();

    holdSlot.mockResolvedValueOnce({
      ok: true,
      data: hold({ start: ELEVEN.start, localTime: '11:00' }),
    });
    await user.click(offered);
    expect(await screen.findByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(holdSlot).toHaveBeenLastCalledWith(expect.objectContaining({ start: ELEVEN.start }));
  });

  it('explains why the visitor is back at the time step when the reservation is lost at the last moment', async () => {
    const user = setup();
    confirm.mockResolvedValueOnce(failure('booking.expired'));
    renderFlow();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Review booking' }));
    await user.click(await screen.findByRole('button', { name: 'Book now' }));

    expect(await screen.findByRole('heading', { name: 'Date and time' })).toBeInTheDocument();
    expect(
      screen.getByText('Your reservation has expired. Please choose a time again.'),
    ).toBeInTheDocument();
    // What the visitor typed survives, so choosing another time does not mean starting over.
    expect(screen.queryByText('BK-ABCD-2345')).not.toBeInTheDocument();
  });

  it('stops the visitor from continuing when the server reports the time as unavailable', async () => {
    const user = setup();
    holdSlot.mockResolvedValueOnce(failure('booking.slot_unavailable'));
    renderFlow();
    await pickTime(user, /October 12, 2026/, /10:00/);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('This time is not available any more. Please choose another time.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your details' })).not.toBeInTheDocument();
  });
});

describe('failures and the editor preview', () => {
  it('shows an error and a way to retry when availability cannot be loaded', async () => {
    const user = setup();
    slots.mockResolvedValueOnce(failure('booking.persistence_failed'));
    renderFlow();
    expect(
      await screen.findByText(
        'The booking system is not available right now. Please try again later.',
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /October 12, 2026/ })).toBeInTheDocument();
  });

  it('says so when a whole month has no times', async () => {
    slots.mockResolvedValue(availability());
    renderFlow();
    expect(await screen.findByText(/No times available in/)).toBeInTheDocument();
  });

  it('never reserves anything in the editor preview', async () => {
    const user = setup();
    renderFlow({ readOnly: true });

    expect(await screen.findByText(/nothing is reserved or booked/)).toBeInTheDocument();
    await pickTime(user, /October 12, 2026/, /10:00/);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(holdSlot).not.toHaveBeenCalled();
  });

  it('starts over after a booking is made', async () => {
    const user = setup();
    renderFlow();
    await reachDetails(user);
    await fillDetails(user);
    await user.click(screen.getByRole('button', { name: 'Review booking' }));
    await user.click(await screen.findByRole('button', { name: 'Book now' }));
    await screen.findByText('BK-ABCD-2345');

    await user.click(screen.getByRole('button', { name: 'Book another appointment' }));
    expect(await screen.findByRole('heading', { name: 'Date and time' })).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('BK-ABCD-2345')).not.toBeInTheDocument();
  });
});

describe('locations in other zones', () => {
  it('labels times with the location zone', async () => {
    const tokyo = { ...BERLIN, timeZone: 'Asia/Tokyo' };
    slots.mockResolvedValue({
      ok: true,
      data: { ...availability(TEN).data, timeZone: 'Asia/Tokyo' },
    });
    renderFlow({ catalog: catalog(service({ locations: [tokyo] })) });
    expect(await screen.findByText(/All times are local time \(Asia\/Tokyo\)/)).toBeInTheDocument();
  });
});
