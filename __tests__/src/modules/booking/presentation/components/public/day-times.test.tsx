import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { DayTimes } from '@modules/booking/presentation/components/public/day-times.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

const SLOT = { start: '2027-01-12T09:00:00+01:00', end: '2027-01-12T09:30:00+01:00' };
const ZONE = 'Europe/Berlin';

describe('public booking times', () => {
  it('keeps the named times grid and zone visible while availability loads, then enables choices', () => {
    const onChoose = vi.fn();
    const view = (times: ReadonlyArray<typeof SLOT> | null) => (
      <NextIntlClientProvider locale="en" messages={enBooking} timeZone={ZONE}>
        <DayTimes
          day="2027-01-12"
          timeZone={ZONE}
          times={times}
          chosenStart={null}
          disabled={false}
          onChoose={onChoose}
        />
      </NextIntlClientProvider>
    );
    const { rerender } = render(view(null));
    const grid = screen.getByRole('list', { name: /Tuesday, January 12, 2027/ });
    const zone = screen.getByText(/Europe\/Berlin/);

    expect(grid).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading times');
    expect(within(grid).queryByRole('button')).not.toBeInTheDocument();

    rerender(view([SLOT]));

    expect(screen.getByRole('list', { name: /Tuesday, January 12, 2027/ })).toBe(grid);
    expect(grid).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText(/Europe\/Berlin/)).toBe(zone);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(within(grid).getByRole('button', { name: /^09:00/ }));
    expect(onChoose).toHaveBeenCalledWith(SLOT);
  });

  it('explains when no free times remain without offering a choice', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enBooking} timeZone={ZONE}>
        <DayTimes
          day="2027-01-12"
          timeZone={ZONE}
          times={[]}
          chosenStart={null}
          disabled={false}
          onChoose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Nothing is free on this day');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
