import { act, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetricGaugeChartClient } from '@modules/component-platform/presentation/components/smartcity/gauge-chart/metric-gauge-chart.client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MetricGaugeChartClient', () => {
  it('draws different arc lengths for different progress toward the same target', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 224, 224),
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const gauge = (percent: number) => (
      <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
        <MetricGaugeChartClient percent={percent} caption="of target" />
      </NextIntlClientProvider>
    );
    const { container, rerender } = render(gauge(25));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    const quarter = container
      .querySelector('.recharts-radial-bar-sectors path.recharts-sector')
      ?.getAttribute('d');
    expect(quarter).toBeTruthy();
    rerender(gauge(50));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    const half = container
      .querySelector('.recharts-radial-bar-sectors path.recharts-sector')
      ?.getAttribute('d');
    expect(half).toBeTruthy();
    expect(half).not.toBe(quarter);
  });
});
