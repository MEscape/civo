// @ui-plain table A public-site block framed by its own Section and SectionHeading; the DataPanel is admin chrome and would repeat the heading in a tinted strip.
import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import {
  Table,
  TableBody,
  TableCaption,
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
import { withUnit } from '../support/chart-tables';
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
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Table>
          <TableCaption className="sr-only">{heading}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="text-start text-sm">
                {t('metricTable.columns.metric')}
              </TableHead>
              <TableHead scope="col" className="text-end text-sm">
                {t('metricTable.columns.value')}
              </TableHead>
              <TableHead scope="col" className="text-start text-sm">
                {t('metricTable.columns.change')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((metric) => (
              <TableRow key={metric.id}>
                <TableHead
                  scope="row"
                  className="h-auto p-4 text-start text-base font-medium text-copy [overflow-wrap:anywhere]"
                >
                  {metric.label}
                </TableHead>
                <TableCell className="text-end text-base font-medium tabular-nums">
                  {withUnit(fmt.number(metric.value), metric.unit)}
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
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
