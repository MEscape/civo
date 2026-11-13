import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';
import { MetricTrendChart } from '@modules/component-platform/presentation/components/smartcity/trend-chart/metric-trend-chart';
import { MetricTrendChartWindow } from '@modules/component-platform/presentation/components/smartcity/trend-chart/metric-trend-chart-window.client';

import { ok } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { createAppFormatters } from '@/i18n/formatters/app-formatters';
import appMessages from '@/i18n/messages/en.json';

import { resolveServerComponents } from '../../../support/server-components';

const action = vi.hoisted(() => vi.fn());
vi.mock('@modules/component-platform/presentation/actions/read-trend-window-action', () => ({
  readTrendWindowAction: action,
}));
vi.mock('@i18n/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
  getAppFormatters: () => Promise.resolve(createAppFormatters('en', 'UTC')),
}));

const NOW = '2026-11-06T08:00:00.000Z';
const FAILED = 'Range unavailable; previous values retained';
const INITIAL = {
  points: [
    { date: NOW, value: 142 },
    { date: '2026-11-06T08:05:00.000Z', value: 143 },
  ],
  unit: 'cm',
  hasMore: true,
};

beforeEach(() => {
  action.mockReset();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 640, 320),
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function showWindow() {
  render(
    <NextIntlClientProvider locale="en" messages={{ app: appMessages }} timeZone="UTC">
      <MetricTrendChartWindow
        initial={INITIAL}
        source={{ websiteId: 'city', datasetId: 'gauge', series: 'Main', category: undefined }}
        initialLimit={50}
        bounds={{ min: 1, max: 50 }}
        labels={{
          group: 'Range',
          zoomIn: 'Zoom in',
          zoomOut: 'Zoom out',
          earlier: 'Earlier',
          later: 'Later',
          failed: FAILED,
          status: 'Measurements: {count}, {from} to {to}',
          figure: {
            label: 'Gauge chart',
            caption: 'Gauge',
            showData: 'Show data',
            dateColumn: 'Time',
            valueColumn: 'Value',
          },
        }}
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText('Show data'));
  return screen.getByRole('region', { name: 'Gauge' });
}

describe('bounded trend windows', () => {
  it('zooms immediately when a complete source has fewer records than the editor limit', async () => {
    const source: LoadContent = (request) =>
      Promise.resolve(
        ok({
          items: getContentDefinition(request.kind).sample(NOW),
          origin: { kind: 'live' } as const,
          truncated: false,
          maxWindowRecords: 500,
        }),
      );
    const recordCount = getContentDefinition('SmartCityObservation').sample(NOW).length;
    expect(recordCount).toBeGreaterThan(1);
    const tree = await MetricTrendChart({
      props: getComponentDefinition('metricTrendChart').parseProps({
        datasetId: 'gauge',
        limit: 500,
      }),
      context: { mode: 'published', websiteId: 'city' },
      loadContent: source,
    });
    render(
      <NextIntlClientProvider locale="en" messages={{ app: appMessages }} timeZone="UTC">
        {await resolveServerComponents(tree)}
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'metricTrendChart.window.zoomOut' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    action.mockResolvedValue({ ok: true, data: INITIAL });
    fireEvent.click(screen.getByRole('button', { name: 'metricTrendChart.window.zoomIn' }));
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalled();
    });
    expect(action.mock.calls[0]?.[0]).toMatchObject({
      limit: Math.floor(recordCount / 2),
      offset: 0,
    });
  });

  it('retains the previous chart/table when a valid request returns no observations', async () => {
    action.mockResolvedValue({ ok: true, data: { points: [], unit: 'cm', hasMore: false } });
    const region = showWindow();
    expect(screen.getByRole('status')).toHaveTextContent('Measurements: 2');
    expect(screen.getByRole('status')).toHaveTextContent('cm');
    fireEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    expect(await screen.findByText(FAILED)).toBeVisible();
    expect(within(region).getByRole('cell', { name: '142 cm' })).toBeVisible();
    expect(within(region).getByRole('cell', { name: '143 cm' })).toBeVisible();
  });

  it('pins the initially selected series and refuses zoom beyond the contributing source budget', async () => {
    const source: LoadContent = (request) =>
      Promise.resolve(
        ok({
          items: getContentDefinition(request.kind)
            .sample(NOW)
            .map((item) => (isPlainObject(item) ? { ...item, series: 'Counter A' } : item)),
          origin: { kind: 'live' } as const,
          truncated: true,
          maxWindowRecords: 50,
        }),
      );
    const tree = await MetricTrendChart({
      props: getComponentDefinition('metricTrendChart').parseProps({
        heading: 'Counter',
        datasetId: 'counters',
        limit: 50,
      }),
      context: { mode: 'published', websiteId: 'city' },
      loadContent: source,
    });
    render(
      <NextIntlClientProvider locale="en" messages={{ app: appMessages }} timeZone="UTC">
        {await resolveServerComponents(tree)}
      </NextIntlClientProvider>,
    );
    const zoomOut = screen.getByRole('button', { name: 'metricTrendChart.window.zoomOut' });
    expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(zoomOut);
    expect(action).not.toHaveBeenCalled();
    action.mockResolvedValue({ ok: true, data: INITIAL });
    fireEvent.click(screen.getByRole('button', { name: 'metricTrendChart.window.zoomIn' }));
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalled();
    });
    expect(action.mock.calls[0]?.[0]).toMatchObject({ series: 'Counter A', limit: 25, offset: 0 });
  });
});
