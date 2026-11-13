import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { pickDistribution } from '../../../../application/contracts/component-platform-constraints';
import { ChartFigure } from '../../shared/chart-figure';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { distributionRows } from '../support/chart-tables';

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
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'SmartCityBreakdownEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('metricDonut.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const distribution = pickDistribution(result.value.items, trimToNull(props.group));
  const title =
    distribution?.group === undefined
      ? heading
      : t('metricDonut.title', { heading, label: distribution.group });

  return distribution === null ? (
    <ContentState kind="empty" heading={heading} />
  ) : (
    <Section className="relative">
      <Container>
        <Rail heading={title} ratio="balanced">
          <ChartFigure
            label={t('charts.chartLabel', { title })}
            showDataLabel={t('charts.showData')}
            table={{
              caption: title,
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
        </Rail>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
