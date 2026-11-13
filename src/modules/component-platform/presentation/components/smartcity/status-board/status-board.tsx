import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

interface StatusBoardProps {
  readonly props: ComponentProps<'statusBoard'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Keep the exact status text and its observation time together; never infer capacity or availability from a number. */
export async function StatusBoard({ props, context, loadContent }: StatusBoardProps) {
  const [t, format, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'GeoFeature',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('statusBoard.defaultHeading');
  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  if (result.value.items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }
  return (
    <Section tone="muted" className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <Grid as="ul" columns={3}>
          {result.value.items.map((place) => (
            <li key={place.id} className="space-y-2 border-t border-border py-4">
              <h3 className="font-medium text-copy [overflow-wrap:anywhere]">{place.name}</h3>
              <Badge variant="secondary">
                {trimToNull(place.status) ?? t('statusBoard.unknownStatus')}
              </Badge>
              <p className="text-sm text-copy-muted tabular-nums">
                {place.observedAt === undefined ? (
                  t('statusBoard.unknownTime')
                ) : (
                  <>
                    <span>{t('statusBoard.observedAt')}</span>{' '}
                    <time dateTime={place.observedAt}>{format.dateTime(place.observedAt)}</time>
                  </>
                )}
              </p>
            </li>
          ))}
        </Grid>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
