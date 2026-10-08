import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { pickDistribution } from '../../../../application/contracts/component-platform-constraints';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { BREAKDOWN_LIMIT } from '../support/dataset-limits';

import { MetricDonutChartClient } from './metric-donut-chart.client';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MetricDonutChartComponentProps {
  readonly props: ComponentProps<'metricDonut'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * A share chart of one distribution. Without an explicit group it shows the
 * group of the first part, so a dataset of one whole needs no setting.
 */
export async function MetricDonutChart({
  props,
  context,
  loadContent,
}: MetricDonutChartComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'SmartCityBreakdownEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      limit: BREAKDOWN_LIMIT,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('metricDonut.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  const distribution = pickDistribution(items, trimToNull(props.group));
  if (distribution === null) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section className="relative">
      <ContentOriginBadge origin={origin} />
      <Container className="max-w-2xl">
        <SectionHeading>
          {distribution.group === undefined
            ? heading
            : t('metricDonut.title', { heading, label: distribution.group })}
        </SectionHeading>
        <MetricDonutChartClient data={distribution.parts} />
      </Container>
    </Section>
  );
}
