import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { pickSeries } from '../../../../application/contracts/component-platform-constraints';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { OBSERVATION_LIMIT } from '../support/dataset-limits';

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
      limit: OBSERVATION_LIMIT,
    }),
  ]);
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
        <MetricTrendChartClient data={series.points} unit={series.unit} />
      </Container>
    </Section>
  );
}
