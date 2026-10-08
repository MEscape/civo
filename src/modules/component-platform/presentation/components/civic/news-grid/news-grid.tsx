import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface NewsGridComponentProps {
  readonly props: ComponentProps<'newsGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** The latest news of a bound dataset. */
export async function NewsGrid({ props, context, loadContent }: NewsGridComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'NewsItem',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: props.category,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('newsGrid.defaultHeading');

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
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full overflow-hidden">
                {item.imageUrl !== undefined && (
                  // eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed
                  <img src={item.imageUrl} alt="" className="h-40 w-full object-cover" />
                )}
                <CardHeader>
                  {item.category !== undefined && (
                    <p className="text-xs font-medium text-accent-copy">{item.category}</p>
                  )}
                  <CardTitle>{item.title}</CardTitle>
                  {item.excerpt !== undefined && <CardDescription>{item.excerpt}</CardDescription>}
                </CardHeader>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
