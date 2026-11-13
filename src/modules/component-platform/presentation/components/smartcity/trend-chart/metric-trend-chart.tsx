import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import {
  LIST_LIMITS,
  pickSeries,
} from '../../../../application/contracts/component-platform-constraints';
import { ChartFigure } from '../../shared/chart-figure';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { trendRows } from '../support/chart-tables';

import { MetricTrendChartWindow } from './metric-trend-chart-window.client';
import { MetricTrendChartClient } from './metric-trend-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

type Series = NonNullable<ReturnType<typeof pickSeries>>;

export interface MetricTrendChartComponentProps {
  readonly props: ComponentProps<'metricTrendChart'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

interface TrendChartBodyProps {
  readonly maxWindowRecords: number | undefined;
  readonly initialRecordCount: number;
  readonly props: ComponentProps<'metricTrendChart'>;
  readonly context: RenderContext;
  readonly series: Series;
  readonly hasMore: boolean;
  /** The section's title, which also names the chart and its table. */
  readonly title: string;
}

/**
 * The chart under the heading. A published page lets the visitor move the
 * window over the series; the canvas draws the fixed slice the editor set.
 * Either way the values are also a table.
 */
async function TrendChartBody({
  props,
  context,
  series,
  hasMore,
  title,
  maxWindowRecords,
  initialRecordCount,
}: TrendChartBodyProps) {
  const [t, fmt] = await Promise.all([getTranslations('componentPlatform'), getAppFormatters()]);
  const figure = {
    label: t('charts.chartLabel', { title }),
    caption: title,
    showData: t('charts.showData'),
    dateColumn: t('charts.columns.date'),
    valueColumn: t('charts.columns.value'),
  };
  const datasetId = trimToNull(props.datasetId);

  if (context.mode !== 'published' || datasetId === null) {
    return (
      <ChartFigure
        label={figure.label}
        showDataLabel={figure.showData}
        table={{
          caption: figure.caption,
          columns: [figure.dateColumn, figure.valueColumn],
          rows: trendRows(series, fmt),
        }}
      >
        <MetricTrendChartClient
          data={series.points}
          unit={series.unit}
          resolution={series.resolution}
        />
      </ChartFigure>
    );
  }

  return (
    <MetricTrendChartWindow
      initial={{ points: series.points, unit: series.unit, resolution: series.resolution, hasMore }}
      source={{
        websiteId: context.websiteId,
        datasetId,
        series: series.name,
        category: categoryFilter(props.category),
      }}
      initialLimit={hasMore ? props.limit : Math.min(props.limit, initialRecordCount)}
      bounds={{
        ...LIST_LIMITS.dataset,
        max: Math.min(
          LIST_LIMITS.dataset.max,
          maxWindowRecords ?? LIST_LIMITS.dataset.max,
          hasMore ? LIST_LIMITS.dataset.max : initialRecordCount,
        ),
      }}
      labels={{
        group: t('metricTrendChart.window.group'),
        zoomIn: t('metricTrendChart.window.zoomIn'),
        zoomOut: t('metricTrendChart.window.zoomOut'),
        earlier: t('metricTrendChart.window.earlier'),
        later: t('metricTrendChart.window.later'),
        failed: t('metricTrendChart.window.failed'),
        status: t('metricTrendChart.window.status', {
          count: '{count}',
          from: '{from}',
          to: '{to}',
        }),
        figure,
      }}
    />
  );
}

export async function MetricTrendChart({
  props,
  context,
  loadContent,
}: MetricTrendChartComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'SmartCityObservation',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: categoryFilter(props.category),
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('metricTrendChart.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const series = pickSeries(result.value.items, trimToNull(props.series));
  const title =
    series === null ? heading : t('metricTrendChart.title', { heading, label: series.name });

  return series === null ? (
    <ContentState kind="empty" heading={heading} />
  ) : (
    <Section tone="muted" className="relative">
      <Container>
        <SectionHeading>{title}</SectionHeading>
        <TrendChartBody
          props={props}
          context={context}
          series={series}
          hasMore={result.value.truncated}
          title={title}
          maxWindowRecords={result.value.maxWindowRecords}
          initialRecordCount={result.value.items.length}
        />
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
