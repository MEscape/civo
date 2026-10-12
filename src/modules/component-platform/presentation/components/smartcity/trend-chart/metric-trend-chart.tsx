import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import {
  LIST_LIMITS,
  pickSeries,
} from '../../../../application/contracts/component-platform-constraints';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';

import { MetricTrendChartWindow } from './metric-trend-chart-window.client';
import { MetricTrendChartClient } from './metric-trend-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MetricTrendChartComponentProps {
  readonly props: ComponentProps<'metricTrendChart'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
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
  const datasetId = trimToNull(props.datasetId);
  const heading = trimToNull(props.heading) ?? t('metricTrendChart.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  const series = pickSeries(items, trimToNull(props.series));
  if (series === null) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section tone="muted" className="relative">
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>
          {t('metricTrendChart.title', { heading, label: series.name })}
        </SectionHeading>
        {context.mode === 'published' && datasetId !== null ? (
          <MetricTrendChartWindow
            initial={{ points: series.points, unit: series.unit, hasMore: result.value.truncated }}
            source={{
              websiteId: context.websiteId,
              datasetId,
              series: trimToNull(props.series),
              category: categoryFilter(props.category),
            }}
            initialLimit={props.limit}
            bounds={LIST_LIMITS.dataset}
            labels={{
              group: t('metricTrendChart.window.group'),
              zoomIn: t('metricTrendChart.window.zoomIn'),
              zoomOut: t('metricTrendChart.window.zoomOut'),
              earlier: t('metricTrendChart.window.earlier'),
              later: t('metricTrendChart.window.later'),
              failed: t('metricTrendChart.window.failed'),
              status: t('metricTrendChart.window.status', { limit: '{limit}', offset: '{offset}' }),
            }}
          />
        ) : (
          <MetricTrendChartClient data={series.points} unit={series.unit} />
        )}
      </Container>
    </Section>
  );
}
