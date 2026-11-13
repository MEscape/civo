import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import type { BookingDto } from '@modules/booking/client';
import { BookingsFilters } from '@modules/booking/presentation/components/bookings/bookings-filters';
import { CalendarEntryContent } from '@modules/booking/presentation/components/calendar/calendar-entry.client';
import { CalendarList } from '@modules/booking/presentation/components/calendar/calendar-list.client';
import type { BookingNamesDto } from '@modules/booking/presentation/dto/booking-dto';
import { nameBookOf } from '@modules/booking/presentation/forms/booking-names';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { expectNoViolations } from '../../../support/a11y';
import { renderServer } from '../support/server-render';

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

const NAMES: BookingNamesDto = {
  isServicesTruncated: false,
  locations: [
    { id: 'l1', name: 'Bürgerbüro West', timeZone: 'Europe/Berlin', today: '2027-01-12' },
  ],
  services: [{ id: 's1', name: 'Passport' }],
  resources: [{ id: 'r1', name: 'Anna Weber', type: 'employee' }],
};
const book = nameBookOf(NAMES, 'unknown');

const booking = (
  id: string,
  day: string,
  from: string,
  to: string,
  overrides: Partial<BookingDto> = {},
): BookingDto => ({
  websiteId: 'w',
  id,
  reference: id,
  status: 'confirmed',
  serviceId: 's1',
  locationId: 'l1',
  timeZone: 'Europe/Berlin',
  start: `${day}T${from}:00+01:00`,
  end: `${day}T${to}:00+01:00`,
  units: [{ requirementIndex: 0, resourceType: 'employee', resourceId: 'r1' }],
  assignment: 'assigned',
  customer: { firstName: 'Julia', lastName: 'Becker', email: 'j@example.org' },
  holdExpiresAt: null,
  rescheduleCount: 0,
  cancelledAt: null,
  createdAt: '2027-01-01T10:00:00+01:00',
  ...overrides,
});

const intl = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      {node}
    </NextIntlClientProvider>,
  );

describe('what an entry says inside its box on the calendar', () => {
  const entry = (minutes: number, view: 'day' | 'week' | 'month' | 'list') => {
    const end = `${String(9 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    return intl(
      <CalendarEntryContent
        booking={booking('b', '2027-01-12', '09:00', end)}
        book={book}
        timeText="09:00"
        view={view}
      />,
    );
  };

  it.each(['day', 'week', 'month', 'list'] as const)(
    'fills the box it is in, in the %s view, so its words are not squeezed to a sliver',
    (view) => {
      const { container } = entry(60, view);
      const root = container.firstElementChild as HTMLElement;

      expect(root.className).toContain('w-full');
      expect(screen.getAllByText(/Passport/).length).toBeGreaterThan(0);
    },
  );

  it('keeps one line for a short appointment and adds the place and the state as it gets longer', () => {
    const short = entry(30, 'day');
    expect(screen.queryByText(/Anna Weber/)).toBeNull();
    short.unmount();

    const quarter = entry(15, 'day');
    expect(screen.queryByText(/Anna Weber/)).toBeNull();
    quarter.unmount();

    entry(60, 'day');
    expect(screen.getByText(/Bürgerbüro West · Anna Weber/)).toBeInTheDocument();
  });

  it('says the state in words or an icon with a word, never by colour alone', () => {
    entry(60, 'day');
    expect(screen.getAllByText('Assigned').length).toBeGreaterThan(0);
  });
});

describe('the calendar’s list of a week', () => {
  const items = [
    booking('a', '2027-01-12', '09:00', '09:45'),
    booking('b', '2027-01-12', '10:00', '10:30', { status: 'cancelled' }),
    booking('c', '2027-01-13', '08:30', '09:00', { assignment: 'open', units: [] }),
  ];

  it('is the module’s own table, with a heading for each day and the states in words', async () => {
    const onSelect = vi.fn();
    const { container } = intl(<CalendarList items={items} book={book} onSelect={onSelect} />);

    const headings = screen.getAllByRole('rowheader');
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveTextContent('Tuesday, January 12, 2027');
    expect(headings[1]).toHaveTextContent('Wednesday, January 13, 2027');
    expect(screen.getAllByText('Passport')).toHaveLength(3);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    await expectNoViolations(container);
  });

  it('opens the same details as the other views from the button of a row', () => {
    const onSelect = vi.fn();
    intl(<CalendarList items={items} book={book} onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button', { name: /^Details of Passport/ });
    fireEvent.click(buttons[2]!);

    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('says there is nothing when the week is empty', () => {
    intl(<CalendarList items={[]} book={book} onSelect={vi.fn()} />);
    expect(screen.getByText('No bookings in this period.')).toBeInTheDocument();
  });
});

describe('the strip above the bookings list', () => {
  const view = (from: string | undefined, to: string | undefined) => ({
    from,
    to,
    state: undefined,
    locationId: undefined,
    serviceId: undefined,
    resourceId: undefined,
    reference: undefined,
    page: 1,
    pageSize: 25,
    bookingId: undefined,
  });
  const today = new Date().toISOString().slice(0, 10);

  async function strip(from?: string, to?: string) {
    return renderServer(
      await BookingsFilters({
        locale: 'en',
        base: '/bookings/site/list',
        view: view(from, to),
        names: NAMES,
        states: <p>states</p>,
      }),
    );
  }

  it('has the period as one select of the filter form, with the chosen quick period shown', async () => {
    await strip(today, today);

    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Today');
    // The days travel as the address keeps them; a quick period needs no fields of its own.
    expect(screen.queryByRole('textbox', { name: 'From' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Period' })).toBeNull();
  });

  it('shows the two days as fields when they were typed by hand', async () => {
    const { container } = await strip('2020-01-01', '2020-01-03');

    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Custom period');
    const from = screen.getByRole('textbox', { name: 'From' });
    expect(from).toHaveAttribute('placeholder', 'From');
    expect(from).toHaveValue('2020-01-01');
    expect(screen.getByRole('textbox', { name: 'To' })).toBeInTheDocument();
    expect(container.querySelector('label[for="bookings-from"]')?.className).toContain('sr-only');
    // The strip is in two sections, as the audit's is.
    expect(container.querySelector('.divide-y')).not.toBeNull();
  });

  it('says any time when no day is asked for', async () => {
    await strip();

    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Any time');
  });
});
