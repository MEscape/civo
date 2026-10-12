import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { stripHtml, trimToNull } from '@lib/utils';

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
const DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' } as const;

export async function NewsGrid({ props, context, loadContent }: NewsGridComponentProps) {
  const [t, fmt, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
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
          {items.map((item) => {
            const rawText = item.excerpt ?? item.content;
            const description =
              rawText !== undefined ? (trimToNull(stripHtml(rawText)) ?? undefined) : undefined;

            return (
              <li key={item.id}>
                <Card className="h-full overflow-hidden">
                  {item.imageUrl !== undefined && (
                    // eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2 text-xs text-copy-muted">
                      {item.category !== undefined ? (
                        <span className="font-medium text-accent-copy">{item.category}</span>
                      ) : (
                        <span />
                      )}
                      <time dateTime={item.publishedAt}>
                        {fmt.date(item.publishedAt, DATE_FORMAT)}
                      </time>
                    </div>
                    <CardTitle>
                      {item.href !== undefined ? (
                        <ContentLink href={item.href} className="hover:text-primary-copy">
                          {item.title}
                        </ContentLink>
                      ) : (
                        item.title
                      )}
                    </CardTitle>
                    {description !== undefined && <CardDescription>{description}</CardDescription>}
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
