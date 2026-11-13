import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';

import { getTranslations, getAppFormatters } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { withUnit } from '../support/chart-tables';

import { MetricGaugeChartClient } from './metric-gauge-chart.client';
import { pickGoal } from './pick-goal';

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
  const goal = pickGoal(result.value.items, trimToNull(props.goalId));
  if (goal === null) {
    return <ContentState kind="empty" heading={customHeading ?? t('metricGauge.defaultHeading')} />;
  }

  return (
    <Section tone="muted" className="relative">
      <Container>
        <Rail heading={customHeading ?? goal.metric.label} ratio="balanced">
          <div className="flex flex-col items-start gap-4">
            <MetricGaugeChartClient
              percent={(goal.metric.value / goal.target) * PERCENT}
              caption={t('metricGauge.progressLabel')}
            />
            <p className="max-w-[var(--civo-measure)] text-base text-copy-muted">
              {t('metricGauge.summary', {
                value: withUnit(fmt.number(goal.metric.value), goal.metric.unit),
                target: withUnit(fmt.number(goal.target), goal.metric.unit),
              })}
            </p>
          </div>
        </Rail>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
