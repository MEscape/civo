import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { groupBy, trimToNull } from '@lib/utils';

import { ChartFigure } from '../../shared/chart-figure';
import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { metricRows } from '../support/chart-tables';

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

/** A simple bar chart comparing metrics at one point in time, with its data as a table. */
export async function MetricChart({ props, context, loadContent }: MetricChartComponentProps) {
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <div className="space-y-8">
          {Array.from(
            groupBy(items, (metric) => metric.unit),
            ([unit, metrics]) => {
              const title = trimToNull(unit) === null ? heading : `${heading} (${unit})`;
              return (
                <div key={unit === undefined ? 'missing-unit' : `unit:${unit}`}>
                  {trimToNull(unit) !== null && (
                    <h3 className="mb-3 font-heading text-lg font-semibold text-copy">{title}</h3>
                  )}
                  <ChartFigure
                    label={t('charts.chartLabel', { title })}
                    showDataLabel={t('charts.showData')}
                    table={{
                      caption: title,
                      columns: [t('charts.columns.label'), t('charts.columns.value')],
                      rows: metricRows(metrics, fmt),
                    }}
                  >
                    <MetricChartClient
                      data={metrics.map((metric) => ({
                        label: metric.label,
                        value: metric.value,
                      }))}
                    />
                  </ChartFigure>
                </div>
              );
            },
          )}
        </div>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
