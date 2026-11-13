import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { AppResult } from '@lib/result';
import { trimToNull } from '@lib/utils';

import { ChartFigure } from '../../shared/chart-figure';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { columnsForCount } from '../../shared/grid-columns';
import { MetricDonutChartClient } from '../donut-chart/metric-donut-chart.client';
import { categoryFilter } from '../support/category-filter';
import { distributionRows, trendRows } from '../support/chart-tables';
import { MetricCard } from '../support/metric-card';
import { MetricTrendChartClient } from '../trend-chart/metric-trend-chart.client';

import { dashboardPanels } from './dashboard-panels';

import type { DashboardPanels } from './dashboard-panels';
import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { ContentLoadError } from '../../../../application/contracts/content-views';
import type { LoadContent } from '../../page-renderer/load-content';

export interface DashboardGridComponentProps {
  readonly props: ComponentProps<'dashboardGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * The three datasets of a dashboard. The trend and the distribution are
 * optional and only loaded when the editor chose a dataset for them; with
 * nothing chosen at all, the editor canvas shows all three as samples.
 */
function loadDashboard({ props, context, loadContent }: DashboardGridComponentProps) {
  const isNothingBound = [props.datasetId, props.trendDatasetId, props.breakdownDatasetId].every(
    (id) => trimToNull(id) === null,
  );
  const wantsSample = context.mode === 'draft' && isNothingBound;
  const wantsTrend = props.showTrend && (wantsSample || trimToNull(props.trendDatasetId) !== null);
  const wantsDistribution =
    props.showBreakdown && (wantsSample || trimToNull(props.breakdownDatasetId) !== null);
  const base = { mode: context.mode, websiteId: context.websiteId };
  const category = categoryFilter(props.category);

  return Promise.all([
    props.showKpis
      ? loadContent({ ...base, kind: 'SmartCityMetric', datasetId: props.datasetId, category })
      : null,
    wantsTrend
      ? loadContent({
          ...base,
          kind: 'SmartCityObservation',
          datasetId: props.trendDatasetId,
          category,
          limit: props.limit,
        })
      : null,
    wantsDistribution
      ? loadContent({
          ...base,
          kind: 'SmartCityBreakdownEntry',
          datasetId: props.breakdownDatasetId,
          limit: props.limit,
        })
      : null,
  ]);
}

function panelState(
  result: AppResult<{ readonly items: readonly unknown[] }, ContentLoadError> | null,
): 'empty' | 'error' | null {
  if (result === null) {
    return null;
  }
  if (result.isErr()) {
    return 'error';
  }
  return result.value.items.length === 0 ? 'empty' : null;
}

async function DashboardCharts({ series, distribution }: Omit<DashboardPanels, 'origin'>) {
  if (series === null && distribution === null) {
    return null;
  }
  const [t, fmt] = await Promise.all([getTranslations('componentPlatform'), getAppFormatters()]);
  const showData = t('charts.showData');
  const trendTitle = series === null ? null : t('dashboardGrid.trendTitle', { label: series.name });
  const distributionTitle =
    distribution?.group === undefined
      ? t('dashboardGrid.distributionFallbackTitle')
      : t('dashboardGrid.distributionTitle', { label: distribution.group });

  // Container query, not a viewport breakpoint: the editor's phone-sized canvas sits in a wide window.
  return (
    <div className="@container mt-10">
      <div className="grid grid-cols-1 gap-x-10 gap-y-10 @3xl:grid-cols-2">
        {series !== null && trendTitle !== null && (
          <div className="min-w-0 border-t border-border pt-4">
            <h3 className="mb-3 font-heading text-lg font-semibold text-copy">{trendTitle}</h3>
            <ChartFigure
              label={t('charts.chartLabel', { title: trendTitle })}
              showDataLabel={showData}
              table={{
                caption: trendTitle,
                columns: [t('charts.columns.date'), t('charts.columns.value')],
                rows: trendRows(series, fmt),
              }}
            >
              <MetricTrendChartClient
                data={series.points}
                unit={series.unit}
                resolution={series.resolution}
              />
            </ChartFigure>
          </div>
        )}
        {distribution !== null && (
          <div className="min-w-0 border-t border-border pt-4">
            <h3 className="mb-3 font-heading text-lg font-semibold text-copy">
              {distributionTitle}
            </h3>
            <ChartFigure
              label={t('charts.chartLabel', { title: distributionTitle })}
              showDataLabel={showData}
              table={{
                caption: distributionTitle,
                columns: [
                  t('charts.columns.label'),
                  t('charts.columns.value'),
                  t('charts.columns.share'),
                ],
                rows: distributionRows(distribution.parts, fmt),
              }}
            >
              <MetricDonutChartClient
                data={distribution.parts}
                othersLabel={t('metricDonut.others')}
              />
            </ChartFigure>
          </div>
        )}
      </div>
    </div>
  );
}

/** KPI figures, a trend chart and a distribution in one section: three shapes, three datasets. */
export async function DashboardGrid(input: DashboardGridComponentProps) {
  const [t, [metrics, observations, parts]] = await Promise.all([
    getTranslations('componentPlatform'),
    loadDashboard(input),
  ]);
  const heading = trimToNull(input.props.heading) ?? t('dashboardGrid.defaultHeading');

  if (metrics === null && observations === null && parts === null) {
    return <ContentState kind="empty" heading={heading} />;
  }
  const figures =
    metrics?.isOk() === true
      ? metrics.value
      : { items: [], origin: { kind: 'unbound' } as const, truncated: false };
  const panels = dashboardPanels(figures, observations, parts);

  return (
    <Section className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>

        {[
          { label: t('kpiGrid.defaultHeading'), state: panelState(metrics) },
          { label: t('metricTrendChart.defaultHeading'), state: panelState(observations) },
          { label: t('metricDonut.defaultHeading'), state: panelState(parts) },
        ].map(({ label, state }) =>
          state === null ? null : (
            <p key={label} role="status" className="mb-4 text-sm text-copy-muted">
              {label}: {state === 'error' ? t('render.sectionUnavailable') : t('states.empty')}
            </p>
          ),
        )}
        {figures.items.length > 0 && (
          <Grid
            as="ul"
            columns={columnsForCount(figures.items.length, input.props.columns)}
            className="gap-x-8 gap-y-8"
          >
            {figures.items.map((metric) => (
              <li key={metric.id}>
                <MetricCard metric={metric} size="compact" />
              </li>
            ))}
          </Grid>
        )}

        <DashboardCharts series={panels.series} distribution={panels.distribution} />
      </Container>
      <ContentOriginBadge origin={panels.origin} />
    </Section>
  );
}
