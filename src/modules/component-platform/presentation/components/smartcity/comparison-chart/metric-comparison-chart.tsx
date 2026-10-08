import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';

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
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
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
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section className="relative">
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <MetricComparisonChartClient
          data={items.map((metric) => ({
            label: metric.label,
            value: metric.value,
            target: metric.target,
          }))}
          labels={{
            actual: t('metricComparisonChart.actual'),
            target: t('metricComparisonChart.target'),
          }}
        />
      </Container>
    </Section>
  );
}
