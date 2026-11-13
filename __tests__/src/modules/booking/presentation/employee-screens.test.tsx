import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DayPlan } from '@modules/booking/presentation/components/employee/day-plan';
import { MessagesList } from '@modules/booking/presentation/components/employee/messages-list';
import { OpenBookingsList } from '@modules/booking/presentation/components/employee/open-bookings-list';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { dayPlan, openBooking, planItem } from '../support/employee-dtos';
import { renderServer } from '../support/server-render';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  claim: vi.fn(),
  handBack: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock('@components/shared/refresh-on-focus', () => ({ RefreshOnFocus: () => null }));
vi.mock('@modules/booking/presentation/actions/claim-booking-action', () => ({
  claimBookingAction: mocks.claim,
}));
vi.mock('@modules/booking/presentation/actions/hand-back-booking-action', () => ({
  handBackBookingAction: mocks.handBack,
}));
vi.mock('@modules/booking/presentation/actions/mark-messages-read-action', () => ({
  markMessagesReadAction: mocks.markRead,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('open bookings (mockup 02)', () => {
  const offers = [
    openBooking('a', 'very-good', 'Reisepass'),
    openBooking('b', 'good', 'Meldebescheinigung'),
    openBooking('c', 'possible', 'Führungszeugnis'),
  ];
  const renderList = async () =>
    renderServer(
      await OpenBookingsList({
        locale: 'en',
        websiteId: 'site',
        items: offers,
        view: {},
        page: undefined,
        locations: [{ id: 'loc-1', name: 'Bürgerbüro Mitte' }],
      }),
    );

  it('shows the fit in words with its reasons, the tabs with their counts, and no customer', async () => {
    const { container } = await renderList();

    expect(screen.getByRole('link', { name: 'Very good fit (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Others (1)' })).toBeInTheDocument();
    expect(screen.getByText('Your service · Your time')).toBeInTheDocument();
    expect(screen.getAllByText('No preference met – you are qualified')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Reisepass' })).toBeInTheDocument();
    expect(screen.getAllByText('Bürgerbüro Mitte · Schalter 1')).toHaveLength(3);
    await expectNoViolations(container);
  });

  it('says "already taken" from the claim’s own answer and offers to read the list again', async () => {
    mocks.claim.mockResolvedValue({
      ok: false,
      error: { kind: 'conflict', code: 'booking.already_assigned' },
    });
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Take appointment: Reisepass' }));

    expect(await screen.findByText(/Already taken/)).toBeInTheDocument();
    expect(mocks.claim).toHaveBeenCalledWith({ websiteId: 'site-1', bookingId: 'a' });
    expect(screen.queryByRole('button', { name: 'Take appointment: Reisepass' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says it is taken only after the server confirmed it', async () => {
    mocks.claim.mockResolvedValue({ ok: true, data: { websiteId: 'site', id: 'b' } });
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Take appointment: Meldebescheinigung' }));

    expect(
      await screen.findByText(/Taken\. The appointment is now in your day plan/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'To my day plan' })).toBeInTheDocument();
  });
});

describe('the day plan (mockups 03 and 06)', () => {
  const plan = dayPlan([
    planItem('done', 'done', ['08:30', '09:00']),
    planItem('now', 'now', ['09:45', '10:15']),
  ]);
  const renderPlan = async (mayHandBack = true) =>
    renderServer(await DayPlan({ locale: 'en', websiteId: 'site', plan, mayHandBack }));

  it('lists the day in order with where each stands, what to bring and the progress', async () => {
    const { container } = await renderPlan();

    expect(screen.getByText(/8:30.*9:00/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getAllByText('To bring: Ausweis, Wohnungsgeberbestätigung')).toHaveLength(2);
    expect(screen.getByText('1 of 2 appointments done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next day' })).toHaveAttribute(
      'href',
      '/bookings/site/me/plan?date=2027-01-15',
    );
    await expectNoViolations(container);
  });

  it('hands a booking back after asking, then reads the plan again', async () => {
    mocks.handBack.mockResolvedValue({ ok: true, data: { websiteId: 'site', id: 'now' } });
    await renderPlan();

    // The details of a row are closed until asked for: the notes, the documents and giving it back.
    fireEvent.click(screen.getAllByRole('button', { name: /Details: Meldebescheinigung/ })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Hand back: Meldebescheinigung' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hand back' }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.handBack).toHaveBeenCalledWith({ websiteId: 'site-1', bookingId: 'now' });
  });

  it('offers no hand-back to someone who does not take bookings', async () => {
    await renderPlan(false);
    expect(screen.queryByRole('button', { name: /Hand back/ })).toBeNull();
  });
});

describe('the inbox (mockup 05)', () => {
  const page = {
    items: [
      {
        id: 'm-1',
        type: 'assigned' as const,
        bookingId: 'b-1',
        serviceName: 'Wohnsitz anmelden',
        locationName: 'Bürgerbüro West',
        timeZone: 'Europe/Berlin',
        start: '2027-01-14T10:30:00+01:00',
        createdAt: '2027-01-14T08:02:00+01:00',
        day: '2027-01-14',
        isRead: false,
      },
      {
        id: 'm-2',
        type: 'cancelled' as const,
        bookingId: 'b-2',
        serviceName: 'Reisepass',
        locationName: 'Bürgerbüro Mitte',
        timeZone: 'Europe/Berlin',
        start: '2027-01-14T09:30:00+01:00',
        createdAt: '2027-01-13T16:42:00+01:00',
        day: '2027-01-13',
        isRead: true,
      },
    ],
    page: 1,
    pageSize: 20,
    total: 2,
    pageCount: 1,
    unread: 1,
    today: '2027-01-14',
    yesterday: '2027-01-13',
  };

  it('shows what a manager changed on the calendar as a message like any other, with the parts named', async () => {
    await renderServer(
      await MessagesList({
        locale: 'en',
        websiteId: 'site',
        page: {
          ...page,
          items: [
            {
              id: 'm-9',
              type: 'calendar_changed' as const,
              parts: ['hours', 'absences'] as const,
              locationName: 'Bürgerbüro West',
              timeZone: 'Europe/Berlin',
              createdAt: '2027-01-14T09:15:00+01:00',
              day: '2027-01-14',
              isRead: false,
            },
          ],
          total: 1,
          unread: 1,
        },
      }),
    );

    expect(screen.getByText('Your calendar was changed')).toBeInTheDocument();
    expect(
      screen.getByText('A manager changed: Working hours, Absences · Bürgerbüro West'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Mark as read: Your calendar was changed/ }),
    ).toBeInTheDocument();
  });

  it('groups by day, says unread in words, and marks all read through the server', async () => {
    mocks.markRead.mockResolvedValue({ ok: true, data: { websiteId: 'site', marked: 1 } });
    const { container } = await renderServer(
      await MessagesList({ locale: 'en', websiteId: 'site', page }),
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Appointment assigned')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Mark as read: Appointment assigned, 0?8:02/ }),
    ).toBeInTheDocument();
    await expectNoViolations(container);

    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.markRead).toHaveBeenCalledWith({ websiteId: 'site-1', messageId: null });
  });
});
