import type { ReactNode } from 'react';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DayPlan } from '@modules/booking/presentation/components/employee/day-plan';
import { EmployeeSetupGuide } from '@modules/booking/presentation/components/employee/employee-setup-guide';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { dayPlan, planItem } from '../support/employee-dtos';
import { renderServer } from '../support/server-render';

vi.mock('@modules/booking/presentation/hooks/use-booking-website', () => ({
  useBookingWebsite: () => 'site-1',
  BookingWebsiteProvider: ({ children }: { children: unknown }) => children,
}));

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  complete: vi.fn(),
  noShow: vi.fn(),
  handBack: vi.fn(),
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
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}));
vi.mock('@modules/booking/presentation/actions/complete-own-booking-action', () => ({
  completeOwnBookingAction: mocks.complete,
}));
vi.mock('@modules/booking/presentation/actions/mark-own-booking-no-show-action', () => ({
  markOwnBookingNoShowAction: mocks.noShow,
}));
vi.mock('@modules/booking/presentation/actions/hand-back-booking-action', () => ({
  handBackBookingAction: mocks.handBack,
}));

const WORKDAY = {
  start: '2027-01-14T08:00:00+01:00',
  end: '2027-01-14T17:00:00+01:00',
  breaks: [{ start: '2027-01-14T11:30:00+01:00', end: '2027-01-14T12:15:00+01:00' }],
};

const items = [
  planItem('a', 'done', ['08:30', '09:00']),
  planItem('b', 'now', ['10:30', '11:00'], { mayRecordOutcome: true, mayHandBack: false }),
  planItem('c', 'upcoming', ['12:15', '12:45']),
];

async function render(plan: ReturnType<typeof dayPlan>, mayHandBack = true) {
  return renderServer(await DayPlan({ locale: 'en', websiteId: 'site', plan, mayHandBack }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the day plan as a day with its breaks', () => {
  it('draws the break of the working hours between the two appointments it lies between', async () => {
    const { container } = await render({ ...dayPlan(items), workday: WORKDAY });

    const heading = screen.getByRole('rowheader');
    expect(heading).toHaveTextContent('Break 11:30 AM–12:15 PM');
    // It sits between the second appointment (ends 11:00) and the third (starts 12:15).
    const rows = screen.getAllByRole('row');
    const at = (text: string) => rows.findIndex((row) => row.textContent?.includes(text));
    expect(at('Break 11:30')).toBeGreaterThan(at('10:30 AM'));
    expect(at('Break 11:30')).toBeLessThan(at('12:15 PM–12:45'));
    await expectNoViolations(container);
  });

  it('draws no break where the working hours have none, or when they are unknown', async () => {
    const view = await render({
      ...dayPlan(items),
      workday: { ...WORKDAY, breaks: [] },
    });
    expect(screen.queryByRole('rowheader')).toBeNull();
    view.unmount();

    await render(dayPlan(items));
    expect(screen.queryByRole('rowheader')).toBeNull();
  });

  it('says when the person works and when they pause, beside the progress', async () => {
    await render({ ...dayPlan(items), workday: WORKDAY });

    const panel = screen.getByRole('region', { name: 'Your day' });
    expect(panel).toHaveTextContent('You work 08:00 AM–05:00 PM');
    expect(panel).toHaveTextContent('Break 11:30 AM–12:15 PM');
  });

  it('says it is a day off when there are no working hours', async () => {
    await render({ ...dayPlan([]), workday: null });
    expect(screen.getByText('No working hours today.')).toBeInTheDocument();
  });
});

describe('what an employee does with an appointment of theirs', () => {
  const open = async () => {
    await render({ ...dayPlan(items), workday: WORKDAY });
    const triggers = screen.getAllByRole('button', { name: /^Details/ });
    fireEvent.click(triggers[1]!);
  };

  it('records that it took place, once it began, and reads the plan again', async () => {
    mocks.complete.mockResolvedValue({ ok: true, data: {} });
    await open();

    fireEvent.click(screen.getByRole('button', { name: /^Mark completed: / }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.complete).toHaveBeenCalledWith({ websiteId: 'site-1', bookingId: 'b' });
    expect(mocks.noShow).not.toHaveBeenCalled();
  });

  it('records that nobody came', async () => {
    mocks.noShow.mockResolvedValue({ ok: true, data: {} });
    await open();

    fireEvent.click(screen.getByRole('button', { name: /^Nobody came to: / }));

    await waitFor(() => {
      expect(mocks.noShow).toHaveBeenCalledWith({ websiteId: 'site-1', bookingId: 'b' });
    });
  });

  it('says why when the server refuses, and does not read the plan again', async () => {
    mocks.complete.mockResolvedValue({
      ok: false,
      error: { kind: 'conflict', code: 'booking.not_started' },
    });
    await open();

    fireEvent.click(screen.getByRole('button', { name: /^Mark completed: / }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('offers neither of them for an appointment that has not begun or is already recorded', async () => {
    await render({ ...dayPlan(items), workday: WORKDAY });
    const triggers = screen.getAllByRole('button', { name: /^Details/ });
    fireEvent.click(triggers[0]!);
    fireEvent.click(triggers[2]!);

    expect(screen.queryByRole('button', { name: /^Mark completed: / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Nobody came to: / })).toBeNull();
    // Giving it back is the other thing an employee does, where the service lets them.
    expect(screen.getAllByRole('button', { name: /Hand back/ })).toHaveLength(2);
  });

  it('offers no hand-back to someone who does not take bookings, but still the outcome', async () => {
    await render({ ...dayPlan(items), workday: WORKDAY }, false);
    const triggers = screen.getAllByRole('button', { name: /^Details/ });
    for (const trigger of triggers) {
      fireEvent.click(trigger);
    }

    expect(screen.queryByRole('button', { name: /Hand back/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Mark completed: / })).toBeInTheDocument();
  });
});

describe('the first steps of an employee on the start page', () => {
  it('leads to the preferences until a service is chosen', async () => {
    const view = await renderServer(
      await EmployeeSetupGuide({
        locale: 'en',
        websiteId: 'site',
        preferences: { serviceIds: [] },
      }),
    );

    expect(screen.getAllByText('1 of 2 steps done').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Set my preferences' })).toHaveAttribute(
      'href',
      '/bookings/site/me/preferences',
    );
    expect(within(view.container).getByText('Your calendar is set up')).toBeInTheDocument();
  });

  it('is gone once the preferences are chosen', async () => {
    const view = await renderServer(
      await EmployeeSetupGuide({
        locale: 'en',
        websiteId: 'site',
        preferences: { serviceIds: ['s'] },
      }),
    );
    expect(view.container).toBeEmptyDOMElement();
  });
});
