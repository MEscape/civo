import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverviewWeekChart } from '@modules/booking/presentation/components/shared/overview-week-chart.client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OverviewWeekChart', () => {
  it('draws the decorative chart without focusable content hidden from assistive technology', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 480, 240),
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    const { container } = render(
      <OverviewWeekChart
        days={[
          {
            day: '2027-01-10',
            label: 'Sun 10',
            summary: 'Sun 10 Jan: 3 bookings, 1 waiting for an employee',
            covered: 2,
            waiting: 1,
          },
        ]}
        names={{ covered: 'Covered by an employee', waiting: 'Waiting for an employee' }}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg.recharts-surface')).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-bar-rectangle path').length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
      ),
    ).toHaveLength(0);
  });
});
