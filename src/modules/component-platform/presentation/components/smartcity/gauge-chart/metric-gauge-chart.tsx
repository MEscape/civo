import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations, getAppFormatters } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import { MetricGaugeChartClient } from './metric-gauge-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

const PERCENT = 100;

export interface MetricGaugeChartComponentProps {
  readonly props: ComponentProps<'metricGauge'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * One goal as progress towards its target. Without an explicit goal id it
 * shows the first goal of the dataset.
 */
export async function MetricGaugeChart({
  props,
  context,
  loadContent,
}: MetricGaugeChartComponentProps) {
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'SmartCityGoal',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const customHeading = trimToNull(props.heading);

  if (result.isErr()) {
    return <ContentState kind="error" heading={customHeading ?? t('metricGauge.defaultHeading')} />;
  }
  const { items, origin } = result.value;
  const goalId = trimToNull(props.goalId);
  const metric = goalId === null ? items[0] : items.find((item) => item.id === goalId);
  const target = metric?.target;
  if (metric === undefined || target === undefined || target === 0) {
    return <ContentState kind="empty" heading={customHeading ?? t('metricGauge.defaultHeading')} />;
  }

  const withUnit = (value: number): string => {
    const formatted = fmt.number(value);
    return metric.unit === undefined ? formatted : `${formatted} ${metric.unit}`;
  };

  return (
    <Section tone="muted" className="relative">
      <ContentOriginBadge origin={origin} />
      <Container className="flex flex-col items-center text-center">
        <SectionHeading className="mb-2">{customHeading ?? metric.label}</SectionHeading>
        <MetricGaugeChartClient
          percent={(metric.value / target) * PERCENT}
          caption={t('metricGauge.progressLabel')}
        />
        <p className="mt-2 text-sm text-copy-muted">
          {t('metricGauge.summary', {
            value: withUnit(metric.value),
            target: withUnit(target),
          })}
        </p>
      </Container>
    </Section>
  );
}
