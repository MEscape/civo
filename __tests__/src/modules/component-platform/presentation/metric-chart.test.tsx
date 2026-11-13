import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';
import { MetricChart } from '@modules/component-platform/presentation/components/smartcity/metric-chart/metric-chart';

import { infrastructureError } from '@lib/errors';
import { err, ok } from '@lib/result';
import { isPlainObject } from '@lib/utils';

import { resolveServerComponents } from '../../../support/server-components';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: { title?: string }) =>
      values?.title === undefined ? key : `${key}:${values.title}`,
    ),
  getAppFormatters: () => Promise.resolve({ number: (value: number) => String(value) }),
}));

const NOW = '2030-06-01T08:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sourceWith(
  options: {
    readonly units?: ReadonlyArray<string | undefined>;
    readonly limit?: number;
  } = {},
): LoadContent {
  return (request) =>
    Promise.resolve(
      ok({
        items: getContentDefinition(request.kind)
          .sample(NOW)
          .slice(0, options.limit)
          .map((item, index) =>
            options.units === undefined || !isPlainObject(item)
              ? item
              : { ...item, unit: options.units[index] },
          ),
        origin: { kind: 'live' } as const,
        truncated: false,
      }),
    );
}

async function renderMetric(loadContent: LoadContent) {
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
  const tree = await MetricChart({
    props: getComponentDefinition('metricChart').parseProps({
      heading: 'Metrics',
      datasetId: 'metrics',
    }),
    context: { mode: 'published', websiteId: 'site-1' },
    loadContent,
  });
  render(
    <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
      {await resolveServerComponents(tree)}
    </NextIntlClientProvider>,
  );
}

function showTables() {
  for (const summary of screen.getAllByText('charts.showData')) {
    fireEvent.click(summary);
  }
}

describe('metric chart units', () => {
  it('gives each source unit a separate labelled figure', async () => {
    await renderMetric(sourceWith());

    expect(screen.getAllByRole('img')).toHaveLength(4);
    for (const unit of ['t pro Einwohner', 'Stück', '%', 'km']) {
      expect(
        screen.getByRole('img', { name: `charts.chartLabel:Metrics (${unit})` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: `Metrics (${unit})`, level: 3 }),
      ).toBeInTheDocument();
    }
  });

  it('keeps metrics sharing one exact unit together with all original values', async () => {
    await renderMetric(sourceWith({ units: ['cm', 'cm', 'cm', 'cm'] }));
    showTables();

    expect(screen.getAllByRole('img')).toHaveLength(1);
    const table = screen.getByRole('table', { name: 'Metrics (cm)' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    for (const value of ['4.2 cm', '48 cm', '62 cm', '124 cm']) {
      expect(within(table).getByRole('cell', { name: value })).toBeInTheDocument();
    }
  });

  it('does not combine different scales of the same dimension', async () => {
    await renderMetric(sourceWith({ units: ['m', 'cm', 'm', 'cm'] }));
    showTables();

    expect(screen.getAllByRole('img')).toHaveLength(2);
    const metres = screen.getByRole('table', { name: 'Metrics (m)' });
    const centimetres = screen.getByRole('table', { name: 'Metrics (cm)' });
    expect(within(metres).getByRole('cell', { name: '4.2 m' })).toBeInTheDocument();
    expect(within(metres).queryByRole('cell', { name: '48 cm' })).not.toBeInTheDocument();
    expect(within(centimetres).getByRole('cell', { name: '48 cm' })).toBeInTheDocument();
    expect(within(centimetres).queryByRole('cell', { name: '62 m' })).not.toBeInTheDocument();
    const metreChart = screen.getByRole('img', { name: 'charts.chartLabel:Metrics (m)' });
    expect(metreChart).toHaveTextContent('erneuerbarer');
    expect(metreChart).not.toHaveTextContent('Radwege');
  });

  it('keeps missing and blank unit groups separate without inventing a unit', async () => {
    await renderMetric(sourceWith({ units: [undefined, '', undefined, ''] }));
    showTables();

    expect(screen.getAllByRole('img', { name: 'charts.chartLabel:Metrics' })).toHaveLength(2);
    expect(screen.getAllByRole('table', { name: 'Metrics' })).toHaveLength(2);
    expect(screen.getAllByRole('cell')).toHaveLength(4);
  });

  it('keeps a one-metric source usable', async () => {
    await renderMetric(sourceWith({ limit: 1 }));
    showTables();

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('cell', { name: '4.2 t pro Einwohner' })).toBeInTheDocument();
  });

  it('keeps the existing empty state', async () => {
    await renderMetric(sourceWith({ limit: 0 }));

    expect(screen.getByRole('status')).toHaveTextContent('states.empty');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('keeps the existing source error state', async () => {
    await renderMetric(() =>
      Promise.resolve(err(infrastructureError('test.failed', 'Unavailable'))),
    );

    expect(screen.getByRole('status')).toHaveTextContent('render.sectionUnavailable');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
