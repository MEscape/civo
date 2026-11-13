import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import type { DayDto } from '@modules/booking/client';
import { WeeklyHoursEditor } from '@modules/booking/presentation/components/shared/weekly-hours-editor.client';
import enBooking from '@modules/booking/presentation/i18n/en.json';

const closed: DayDto = { intervals: [], breaks: [] };
const open = (start: string, end: string): DayDto => ({
  intervals: [{ start, end }],
  breaks: [],
});

/** The place is open Monday to Friday 08:00–12:00, and closed at the weekend. */
const LOCATION: DayDto[] = [0, 1, 2, 3, 4, 5, 6].map((index) =>
  index < 5 ? open('08:00', '12:00') : closed,
);

function Harness({ bounds }: { bounds?: DayDto[] }) {
  const [week, setWeek] = useState<DayDto[]>(LOCATION.map((day) => ({ ...day })));
  return (
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone="Europe/Berlin">
      <WeeklyHoursEditor
        value={week}
        errors={{}}
        bounds={bounds}
        onChange={(next) => {
          setWeek(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

describe('the week of an employee or a resource inside the hours of its location', () => {
  it('shades what lies outside the opening hours of the location, and says why', () => {
    render(<Harness bounds={LOCATION} />);

    expect(
      screen.getAllByTitle('Outside the location’s opening hours').length,
    ).toBeGreaterThanOrEqual(7);
  });

  it('draws no shading where nothing limits the week', () => {
    render(<Harness />);
    expect(screen.queryAllByTitle('Outside the location’s opening hours')).toHaveLength(0);
  });

  it('cannot open a day the location is closed on, and says why on the button', () => {
    render(<Harness bounds={LOCATION} />);
    const openButtons = screen.getAllByRole('button', { name: 'Open' });

    expect(openButtons).toHaveLength(2);
    for (const button of openButtons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'The location is closed on this day');
    }
  });

  it('stops a handle at the edge of the opening hours when it is moved with the keyboard', () => {
    render(<Harness bounds={LOCATION} />);
    const [end] = screen.getAllByRole('slider', { name: /Monday, period 1: end/ });
    if (end === undefined) {
      throw new Error('no handle');
    }

    // Shift + arrow moves an hour; the place closes at 12:00, so the range stays there.
    fireEvent.keyDown(end, { key: 'ArrowRight', shiftKey: true });
    expect(end).toHaveAttribute('aria-valuetext', '12:00');
    fireEvent.keyDown(end, { key: 'ArrowLeft', shiftKey: true });
    expect(end).toHaveAttribute('aria-valuetext', '11:00');
  });

  it('lets the end go past the opening hours where there are no bounds', () => {
    render(<Harness />);
    const [end] = screen.getAllByRole('slider', { name: /Monday, period 1: end/ });
    if (end === undefined) {
      throw new Error('no handle');
    }

    fireEvent.keyDown(end, { key: 'ArrowRight', shiftKey: true });
    expect(end).toHaveAttribute('aria-valuetext', '13:00');
  });
});
