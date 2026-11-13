import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { BOOKING_STATUSES } from '@modules/booking/application/contracts/booking-constraints';
import type { BookingDto } from '@modules/booking/client';
import { BookingStatusChip } from '@modules/booking/presentation/components/shared/booking-status-chip';
import deBooking from '@modules/booking/presentation/i18n/de.json';
import enBooking from '@modules/booking/presentation/i18n/en.json';

type Status = BookingDto['status'];
type Assignment = BookingDto['assignment'];

function renderChip(status: Status, assignment: Assignment, locale: 'en' | 'de' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? enBooking : deBooking}
      timeZone="UTC"
    >
      <BookingStatusChip status={status} assignment={assignment} />
    </NextIntlClientProvider>,
  );
}

/** What each status is called in English; a status the domain adds must be added here and in the catalogs. */
const WORD_BY_STATUS: Record<Exclude<Status, 'confirmed'>, string> = {
  held: 'Reserved',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
  expired: 'Expired',
};

describe('BookingStatusChip', () => {
  it('knows every status the domain has', () => {
    expect([...BOOKING_STATUSES].sort()).toEqual(
      [...Object.keys(WORD_BY_STATUS), 'confirmed'].sort(),
    );
  });

  it.each(Object.entries(WORD_BY_STATUS))(
    'says %s as "%s", whatever the assignment',
    (status, word) => {
      renderChip(status as Status, 'open');

      expect(screen.getByText(word)).toBeInTheDocument();
    },
  );

  it('tells a confirmed booking apart by whether an employee still has to take it', () => {
    const { unmount } = renderChip('confirmed', 'open');
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Assigned')).not.toBeInTheDocument();
    unmount();

    renderChip('confirmed', 'assigned');
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });

  it('draws an icon beside the word, hidden from assistive technology so the word is the status', () => {
    const { container } = renderChip('confirmed', 'assigned');

    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('Assigned');
  });

  it('speaks the language of the request', () => {
    renderChip('confirmed', 'open', 'de');

    expect(screen.getByText('Offen')).toBeInTheDocument();
  });
});
