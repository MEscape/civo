import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { getTranslations, getAppFormatters } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { TrendIndicator } from '../support/trend-indicator';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface MetricTableComponentProps {
  readonly props: ComponentProps<'metricTable'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Metrics as a dense table, for pages where tiles are too sparse. */
export async function MetricTable({ props, context, loadContent }: MetricTableComponentProps) {
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
  const heading = trimToNull(props.heading) ?? t('metricTable.defaultHeading');

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('metricTable.columns.metric')}</TableHead>
              <TableHead>{t('metricTable.columns.value')}</TableHead>
              <TableHead>{t('metricTable.columns.change')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((metric) => (
              <TableRow key={metric.id}>
                <TableCell>{metric.label}</TableCell>
                <TableCell>
                  {fmt.number(metric.value)}
                  {metric.unit === undefined ? '' : ` ${metric.unit}`}
                </TableCell>
                <TableCell>
                  {metric.trend !== undefined && metric.changePercent !== undefined ? (
                    <TrendIndicator
                      trend={metric.trend}
                      changePercent={metric.changePercent}
                      className="inline-flex"
                    />
                  ) : (
                    t('metricTable.noChange')
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Container>
    </Section>
  );
}
