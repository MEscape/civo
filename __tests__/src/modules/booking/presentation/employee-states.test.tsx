import type { ReactNode } from 'react';

import { fireEvent, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { DayPlan } from '@modules/booking/presentation/components/employee/day-plan';
import { MessagesList } from '@modules/booking/presentation/components/employee/messages-list';
import { NextAppointment } from '@modules/booking/presentation/components/employee/next-appointment';
import { OpenBookingsList } from '@modules/booking/presentation/components/employee/open-bookings-list';
import type { MessageDto } from '@modules/booking/presentation/dto/employee-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { dayPlan, openBooking, planItem } from '../support/employee-dtos';
import { renderServer } from '../support/server-render';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@components/shared/refresh-on-focus', () => ({ RefreshOnFocus: () => null }));

const PHASES = ['done', 'missed', 'past', 'now', 'upcoming'] as const;
const PHASE_WORDS = {
  done: 'Done',
  missed: 'No-show',
  past: 'Over',
  now: 'Now',
  upcoming: 'Planned',
} as const;

async function renderPlan(plan: ReturnType<typeof dayPlan>, mayHandBack = true) {
  return renderServer(await DayPlan({ locale: 'en', websiteId: 'site', plan, mayHandBack }));
}

describe('the day plan in every state', () => {
  it('says every phase in words, so none is told by its icon or colour alone', async () => {
    const items = PHASES.map((phase, index) =>
      planItem(phase, phase, [`0${String(index + 8)}:00`, `0${String(index + 8)}:30`]),
    );
    const { container } = await renderPlan(dayPlan(items));

    for (const phase of PHASES) {
      expect(screen.getByText(PHASE_WORDS[phase])).toBeInTheDocument();
    }
    await expectNoViolations(container);
  });

  it('fills the bar for a day with nothing in it, and says so with a tick', async () => {
    await renderPlan(dayPlan([]));

    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
    expect(screen.getByText('0 of 0 appointments done')).toBeInTheDocument();
    expect(screen.getByText('You have no appointments on this day.')).toBeInTheDocument();
  });

  it('shows the bar at the share that is done, and full when all of them are', async () => {
    const view = await renderPlan(
      dayPlan([
        planItem('a', 'done', ['08:00', '08:30']),
        planItem('b', 'upcoming', ['09:00', '09:30']),
      ]),
    );
    const half = screen.getByRole('progressbar', { name: 'Progress' });
    expect(half).toHaveAttribute('aria-valuenow', '1');
    expect(half).toHaveAttribute('aria-valuemax', '2');
    view.unmount();

    await renderPlan(
      dayPlan([
        planItem('a', 'done', ['08:00', '08:30']),
        planItem('b', 'done', ['09:00', '09:30']),
      ]),
    );
    const full = screen.getByRole('progressbar', { name: 'Progress' });
    expect(full).toHaveAttribute('aria-valuenow', '2');
    expect(full).toHaveAttribute('aria-valuemax', '2');
  });

  it('keeps the details shut until asked, and falls back to words when there is nothing to say', async () => {
    await renderPlan(
      dayPlan([
        planItem('a', 'upcoming', ['08:00', '08:30'], {
          instructions: null,
          requiredDocuments: [],
        }),
      ]),
    );

    expect(screen.queryByText('No particular notes for this service.')).toBeNull();
    expect(screen.queryByText(/^To bring:/)).toBeNull();
    const trigger = screen.getByRole('button', { name: /^Details/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /Details/ })).toBeInTheDocument();
    expect(screen.getByText('No particular notes for this service.')).toBeInTheDocument();
  });

  it('names a service that has no name instead of leaving the row blank', async () => {
    await renderPlan(
      dayPlan([
        planItem('a', 'upcoming', ['08:00', '08:30'], {
          labels: { serviceName: null, locationName: null, resourceNames: [] },
        }),
      ]),
    );

    expect(screen.getAllByText('Service no longer available').length).toBeGreaterThan(0);
  });

  it('shows no hand-back on a booking that cannot be given back, even to someone who may', async () => {
    await renderPlan(
      dayPlan([planItem('a', 'upcoming', ['08:00', '08:30'], { mayHandBack: false })]),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Details/ }));

    expect(screen.queryByRole('button', { name: /Hand back/ })).toBeNull();
  });

  it('leads a phone with the next appointment, only on today and only when there is one', async () => {
    const item = planItem('n', 'upcoming', ['09:45', '10:15']);
    const today = { ...dayPlan([item]), next: { bookingId: 'n', minutesUntil: 12 } };

    const view = await renderPlan(today);
    const card = screen.getByRole('region', { name: 'Meldebescheinigung' });
    expect(card.className).toContain('lg:hidden');
    expect(within(card).getByText('Next appointment · in 12 minutes')).toBeInTheDocument();
    view.unmount();

    // Another day has no "next": the plan alone.
    await renderPlan({ ...today, date: '2027-01-15' });
    expect(screen.queryByText(/Next appointment/)).toBeNull();
  });
});

describe('the next appointment in every state', () => {
  const item = planItem('n', 'upcoming', ['09:45', '10:15']);
  const render = async (minutes: number, overrides = {}) =>
    renderServer(
      await NextAppointment({
        locale: 'en',
        websiteId: 'site',
        item: { ...item, ...overrides },
        minutesUntil: minutes,
      }),
    );

  it.each([
    [0, 'in 0 minutes'],
    [1, 'in 1 minute'],
    [12, 'in 12 minutes'],
  ])('counts %i minutes in the right plural', async (minutes, words) => {
    await render(minutes);
    expect(screen.getByText(new RegExp(words))).toBeInTheDocument();
  });

  it('asks the employee to check what the citizen brings, only when something is needed', async () => {
    const view = await render(5);
    expect(screen.getByText(/Ausweis, Wohnungsgeberbestätigung/)).toBeInTheDocument();
    view.unmount();

    await render(5, { requiredDocuments: [] });
    expect(screen.queryByText(/Ausweis/)).toBeNull();
  });

  it('opens the appointment in the day plan', async () => {
    await render(5);
    expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/bookings/site/me/plan#booking-n',
    );
  });
});

describe('open bookings in every state', () => {
  const locations = [{ id: 'loc-1', name: 'Bürgerbüro Mitte' }];
  const render = async (items: Array<ReturnType<typeof openBooking>>, view = {}) =>
    renderServer(
      await OpenBookingsList({
        locale: 'en',
        websiteId: 'site',
        items,
        view,
        page: undefined,
        locations,
      }),
    );

  it('says there is nothing to take when the list is empty, and still shows the filters', async () => {
    const { container } = await render([]);

    expect(screen.getByText('There are no open bookings for you right now.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Very good fit (0)' })).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('counts each fit level and keeps the others out of a narrowed list', async () => {
    await render(
      [openBooking('a', 'very-good', 'Reisepass'), openBooking('b', 'possible', 'Kfz')],
      { fit: 'very-good' },
    );

    expect(screen.getByRole('heading', { name: 'Reisepass' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Kfz' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Others (1)' })).toBeInTheDocument();
  });
});

describe('the inbox in every state', () => {
  const message = (
    id: string,
    type: Exclude<MessageDto['type'], 'calendar_changed'>,
    isRead: boolean,
  ): MessageDto => ({
    id,
    type,
    bookingId: `b-${id}`,
    serviceName: null,
    locationName: null,
    timeZone: 'Europe/Berlin',
    start: '2027-01-14T10:30:00+01:00',
    createdAt: '2027-01-14T08:02:00+01:00',
    day: '2027-01-14',
    isRead,
  });
  const page = (items: MessageDto[], unread: number) => ({
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    pageCount: 1,
    unread,
    today: '2027-01-14',
    yesterday: '2027-01-13',
  });

  it('says there is nothing when the inbox is empty, and offers no "mark all read"', async () => {
    const { container } = await renderServer(
      await MessagesList({ locale: 'en', websiteId: 'site', page: page([], 0) }),
    );

    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
    await expectNoViolations(container);
  });

  it('words every kind of message, and names a service that has none', async () => {
    await renderServer(
      await MessagesList({
        locale: 'en',
        websiteId: 'site',
        page: page(
          [
            message('1', 'assigned', true),
            message('2', 'unassigned', true),
            message('3', 'cancelled', true),
            message('4', 'rescheduled', true),
          ],
          0,
        ),
      }),
    );

    for (const words of [
      'Appointment assigned',
      'Assignment removed',
      'Appointment cancelled',
      'Appointment moved',
    ]) {
      expect(screen.getByText(words)).toBeInTheDocument();
    }
    expect(screen.queryByText('Unread')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).toBeNull();
  });
});
