import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { categoryFilter } from '../support/category-filter';
import { MetricCard } from '../support/metric-card';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface KpiGridComponentProps {
  readonly props: ComponentProps<'kpiGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Key figures as tiles. */
export async function KpiGrid({ props, context, loadContent }: KpiGridComponentProps) {
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
  const heading = trimToNull(props.heading) ?? t('kpiGrid.defaultHeading');

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
        <Grid as="ul" columns={props.columns}>
          {items.map((metric) => (
            <li key={metric.id}>
              <MetricCard metric={metric} />
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
