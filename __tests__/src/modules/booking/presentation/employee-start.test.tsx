import type { ReactNode } from 'react';

import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { EmployeeStart } from '@modules/booking/presentation/components/employee/employee-start';
import type { MessageDto } from '@modules/booking/presentation/dto/employee-dto';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { dayPlan, openBooking, planItem } from '../support/employee-dtos';
import { renderServer } from '../support/server-render';

vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' }),
  getAppFormatters: async () => ({ number: (value: number) => String(value) }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MESSAGE: MessageDto = {
  id: 'm1',
  type: 'assigned',
  bookingId: 'b1',
  serviceName: 'Passport',
  locationName: 'Town hall',
  timeZone: 'Europe/Berlin',
  start: '2027-01-14T10:00:00+01:00',
  createdAt: '2027-01-14T08:00:00+01:00',
  day: '2027-01-14',
  isRead: false,
};

async function start(overrides: Partial<Parameters<typeof EmployeeStart>[0]> = {}) {
  return renderServer(
    await EmployeeStart({
      locale: 'en',
      websiteId: 'site',
      plan: dayPlan([]),
      open: [],
      unread: 0,
      fresh: [],
      ...overrides,
    }),
  );
}

describe('the employee start', () => {
  it('shows the figures of the day as tiles, each the way to its page, and no number is hidden for being zero', async () => {
    const { container } = await start();

    expect(screen.getByRole('link', { name: /Today.*0.*Nothing planned/ })).toHaveAttribute(
      'href',
      '/bookings/site/me/plan',
    );
    expect(screen.getByRole('link', { name: /Open bookings.*0/ })).toHaveAttribute(
      'href',
      '/bookings/site/me/open',
    );
    expect(screen.getByRole('link', { name: /New messages.*0/ })).toHaveAttribute(
      'href',
      '/bookings/site/me/messages',
    );
    await expectNoViolations(container);
  });

  it('counts only good and very good matches as the open bookings that suit the employee', async () => {
    await start({
      open: [
        openBooking('a', 'very-good', 'Passport'),
        openBooking('b', 'good', 'ID'),
        openBooking('c', 'possible', 'Registration'),
      ],
    });

    expect(screen.getByRole('link', { name: /Open bookings.*2/ })).toBeInTheDocument();
    expect(screen.getByText('2 match you')).toBeInTheDocument();
  });

  it('leaves out the open bookings and the preferences for someone who may not take any', async () => {
    await start({ open: null });

    expect(screen.queryByRole('link', { name: /Open bookings/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Adjust my preferences/ })).toBeNull();
    expect(screen.getByRole('link', { name: /See my day plan/ })).toBeInTheDocument();
  });

  it('puts the next appointment above the day, with the way to its details, and says how far the day is', async () => {
    const plan = {
      ...dayPlan([
        planItem('done', 'done', ['08:30', '09:00']),
        planItem('next', 'upcoming', ['09:45', '10:15']),
      ]),
      next: { bookingId: 'next', minutesUntil: 15 },
    };
    await start({ plan });

    expect(screen.getByText('Next appointment · in 15 minutes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute(
      'href',
      '/bookings/site/me/plan#booking-next',
    );
    expect(screen.getByRole('heading', { name: 'Today · 2 appointments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Today.*2.*1 of 2 done/ })).toBeInTheDocument();
  });

  it('says so, with the way on, when there is nothing today and nothing new', async () => {
    await start();

    expect(screen.getByText('You have no appointments today.')).toBeInTheDocument();
    expect(screen.getByText('No new messages.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open appointment' })).toBeNull();
  });

  it('shows fresh appointment information without customer details, and marks unread ones in the tile', async () => {
    await start({ unread: 1, fresh: [MESSAGE] });

    expect(screen.getByText('Appointment assigned')).toBeInTheDocument();
    expect(screen.getByText(/Passport.*Town hall/)).toBeInTheDocument();
    expect(screen.queryByText('No new messages.')).toBeNull();
    expect(screen.getByRole('link', { name: /New messages.*1/ })).toBeInTheDocument();
  });
});
