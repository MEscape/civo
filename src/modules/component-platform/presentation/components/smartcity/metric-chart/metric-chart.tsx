import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';

import { MetricChartClient } from './metric-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MetricChartComponentProps {
  readonly props: ComponentProps<'metricChart'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** A simple bar chart comparing metrics at one point in time. */
export async function MetricChart({ props, context, loadContent }: MetricChartComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'SmartCityMetric',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: categoryFilter(props.category),
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('metricChart.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section tone="muted" className="relative">
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <MetricChartClient
          data={items.map((metric) => ({
            label: metric.label,
            value: metric.value,
          }))}
        />
      </Container>
    </Section>
  );
}
