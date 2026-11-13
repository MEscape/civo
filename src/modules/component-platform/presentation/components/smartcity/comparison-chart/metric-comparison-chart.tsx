import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ChartFigure } from '../../shared/chart-figure';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { comparisonRows } from '../support/chart-tables';

import { MetricComparisonChartClient } from './metric-comparison-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MetricComparisonChartComponentProps {
  readonly props: ComponentProps<'metricComparisonChart'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Current value against target, side by side, for several goals. */
export async function MetricComparisonChart({
  props,
  context,
  loadContent,
}: MetricComparisonChartComponentProps) {
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'SmartCityGoal',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: categoryFilter(props.category),
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('metricComparisonChart.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  if (result.value.items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  const data = result.value.items.map((metric) => ({
    label: metric.label,
    value: metric.value,
    target: metric.target,
  }));

  return (
    <Section className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <ChartFigure
          label={t('charts.chartLabel', { title: heading })}
          showDataLabel={t('charts.showData')}
          table={{
            caption: heading,
            columns: [
              t('charts.columns.label'),
              t('metricComparisonChart.actual'),
              t('metricComparisonChart.target'),
            ],
            rows: comparisonRows(data, fmt),
          }}
        >
          <MetricComparisonChartClient
            data={data}
            labels={{
              actual: t('metricComparisonChart.actual'),
              target: t('metricComparisonChart.target'),
            }}
          />
        </ChartFigure>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
