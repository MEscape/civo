import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { CardDescription } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { cn, stripHtml, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';
import { NewsCard } from '../../shared/news-card';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';
import type { NewsItemView } from '../../shared/news-card';

const DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' } as const;

/** The first story leads only when enough follow it for the contrast to mean something. */
const LEAD_MIN_ITEMS = 3;

export interface NewsGridComponentProps {
  readonly props: ComponentProps<'newsGrid'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

function descriptionOf(item: NewsItemView): string | undefined {
  const rawText = item.excerpt ?? item.content;
  return rawText !== undefined ? (trimToNull(stripHtml(rawText)) ?? undefined) : undefined;
}

interface LeadStoryProps {
  readonly item: NewsItemView;
  readonly description: string | undefined;
  readonly dateLabel: string;
}

/** The first story, set wide and without a box: a picture beside a larger title. */
function LeadStory({ item, description, dateLabel }: LeadStoryProps) {
  const hasImage = item.imageUrl !== undefined;

  return (
    <div className="@container">
      <article className="grid gap-6 border-b border-border pb-8 @4xl:grid-cols-12 @4xl:items-center @4xl:gap-10">
        {item.imageUrl !== undefined && (
          <div className="@4xl:col-span-7">
            {/* eslint-disable-next-line @next/next/no-img-element -- the URL comes from municipal content on any host; next/image would need each host allow-listed */}
            <img
              src={item.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[3/2] w-full bg-surface object-cover"
            />
          </div>
        )}
        <div
          className={cn(
            'min-w-0',
            hasImage ? '@4xl:col-span-5' : 'max-w-[var(--civo-measure)] @4xl:col-span-12',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-copy-muted">
            {item.category !== undefined && (
              <span className="font-medium text-accent-copy">{item.category}</span>
            )}
            <time dateTime={item.publishedAt} className="tabular-nums">
              {dateLabel}
            </time>
          </div>
          <h3 className="mt-3 font-heading text-2xl leading-snug text-balance text-copy sm:text-3xl">
            {item.href !== undefined ? (
              <ContentLink href={item.href} className="hover:text-primary-copy hover:underline">
                {item.title}
              </ContentLink>
            ) : (
              item.title
            )}
          </h3>
          {description !== undefined && (
            <p className="mt-4 line-clamp-4 text-base text-copy-muted">{description}</p>
          )}
        </div>
      </article>
    </div>
  );
}

/** The latest news of a bound dataset; with enough items the first one leads. */
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
  if (result.value.items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  const lead = result.value.items.length >= LEAD_MIN_ITEMS ? result.value.items[0] : undefined;

  return (
    <Section className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <div className="flex flex-col gap-8">
          {lead !== undefined && (
            <LeadStory
              item={lead}
              description={descriptionOf(lead)}
              dateLabel={fmt.date(lead.publishedAt, DATE_FORMAT)}
            />
          )}
          <Grid as="ul" columns={props.columns}>
            {(lead === undefined ? result.value.items : result.value.items.slice(1)).map((item) => {
              const description = descriptionOf(item);

              return (
                <li key={item.id}>
                  <NewsCard
                    item={item}
                    dateLabel={fmt.date(item.publishedAt, DATE_FORMAT)}
                    description={
                      description !== undefined ? (
                        <CardDescription>{description}</CardDescription>
                      ) : undefined
                    }
                    showImage
                  />
                </li>
              );
            })}
          </Grid>
        </div>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
