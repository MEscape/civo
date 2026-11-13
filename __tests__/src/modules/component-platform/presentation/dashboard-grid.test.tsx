import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getComponentDefinition } from '@modules/component-platform/application/contracts/component-platform-constraints';
import type { ContentKind } from '@modules/component-platform/application/contracts/component-platform-constraints';
import { getContentDefinition } from '@modules/component-platform/domain/content/content-definitions';
import type { LoadContent } from '@modules/component-platform/presentation/components/page-renderer/load-content';
import { DashboardGrid } from '@modules/component-platform/presentation/components/smartcity/dashboard-grid/dashboard-grid';

import { infrastructureError } from '@lib/errors';
import { err, ok } from '@lib/result';

import { resolveServerComponents } from '../../../support/server-components';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve((key: string, values?: { label?: string }) =>
      values?.label === undefined ? key : `${key}:${values.label}`,
    ),
  getAppFormatters: () =>
    Promise.resolve({
      date: (value: string) => value,
      number: (value: number) => String(value),
      percent: (value: number) => String(value),
    }),
}));

const NOW = '2030-06-01T08:00:00.000Z';
const BOUND = {
  datasetId: 'metrics',
  trendDatasetId: 'observations',
  breakdownDatasetId: 'parts',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function sourceWith(
  options: {
    readonly failed?: readonly ContentKind[];
    readonly empty?: readonly ContentKind[];
    readonly forbidden?: readonly ContentKind[];
  } = {},
): LoadContent {
  return (request) => {
    if (options.forbidden?.includes(request.kind) === true) {
      throw new Error(`Disabled panel requested ${request.kind}`);
    }
    return Promise.resolve(
      options.failed?.includes(request.kind) === true
        ? err(infrastructureError('test.failed', 'Source unavailable'))
        : ok({
            items:
              options.empty?.includes(request.kind) === true
                ? []
                : getContentDefinition(request.kind).sample(NOW),
            origin: { kind: 'live' } as const,
            truncated: false,
          }),
    );
  };
}

async function renderDashboard(
  props: Record<string, unknown>,
  loadContent: LoadContent,
  mode: 'published' | 'draft' = 'published',
) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const tree = await DashboardGrid({
    props: getComponentDefinition('dashboardGrid').parseProps(props),
    context: { mode, websiteId: 'site-1' },
    loadContent,
  });
  render(
    <NextIntlClientProvider locale="en" messages={{}} timeZone="UTC">
      {await resolveServerComponents(tree)}
    </NextIntlClientProvider>,
  );
}

describe('independent dashboard panels', () => {
  it.each([undefined, 'unavailable-metrics'])(
    'does not load disabled KPIs (%s)',
    async (datasetId) => {
      await renderDashboard(
        { ...BOUND, datasetId, showKpis: false },
        sourceWith({ forbidden: ['SmartCityMetric'] }),
      );

      expect(screen.getAllByRole('img')).toHaveLength(2);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );

  it.each(['failed', 'empty'] as const)('keeps both charts when KPIs are %s', async (state) => {
    await renderDashboard(BOUND, sourceWith({ [state]: ['SmartCityMetric'] }));

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(
      `kpiGrid.defaultHeading: ${state === 'failed' ? 'render.sectionUnavailable' : 'states.empty'}`,
    );
  });

  it.each([
    ['SmartCityObservation', 'metricTrendChart.defaultHeading'],
    ['SmartCityBreakdownEntry', 'metricDonut.defaultHeading'],
  ] as const)('shows a failed %s without losing the other panels', async (kind, label) => {
    await renderDashboard(BOUND, sourceWith({ failed: [kind] }));

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(`${label}: render.sectionUnavailable`);
  });

  it('labels an empty trend without losing the distribution', async () => {
    await renderDashboard(BOUND, sourceWith({ empty: ['SmartCityObservation'] }));

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'metricTrendChart.defaultHeading: states.empty',
    );
  });

  it('does not replace an unbound optional panel with samples when another panel is bound', async () => {
    await renderDashboard(
      { breakdownDatasetId: 'parts', showKpis: false },
      sourceWith({ forbidden: ['SmartCityMetric', 'SmartCityObservation'] }),
      'draft',
    );

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('preserves all three sample panels on a completely unbound draft', async () => {
    await renderDashboard({}, sourceWith(), 'draft');

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('shows an empty state when every panel is disabled', async () => {
    await renderDashboard(
      { ...BOUND, showKpis: false, showTrend: false, showBreakdown: false },
      sourceWith({
        forbidden: ['SmartCityMetric', 'SmartCityObservation', 'SmartCityBreakdownEntry'],
      }),
    );

    expect(screen.getByRole('status')).toHaveTextContent('states.empty');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
