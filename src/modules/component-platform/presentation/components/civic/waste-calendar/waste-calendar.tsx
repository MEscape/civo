import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';
import type { BadgeProps } from '@components/ui/badge';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { hasOwnKey, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { ContentListView } from '../../../../application/contracts/content-views';
import type { LoadContent } from '../../page-renderer/load-content';

type CollectionEntry = ContentListView<'WasteCollectionEntry'>['items'][number];

/** One distinct token colour per bin, so neighbouring dates are told apart at a glance; the label carries the meaning too. */
const BADGE_VARIANTS = {
  restmuell: 'secondary',
  biomuell: 'success',
  papier: 'info',
  gelberSack: 'warning',
  sperrmuell: 'accent',
} as const satisfies Record<string, BadgeProps['variant']>;

const LEAD_DATE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long' } as const;
const ROW_DATE_FORMAT = { weekday: 'short', day: '2-digit', month: 'short' } as const;

/** Historical stored keys stay translated; source-defined collection labels remain unchanged. */
async function WasteTypeBadge({ type }: { readonly type: string }) {
  const t = await getTranslations('componentPlatform');
  return (
    <Badge
      variant={hasOwnKey(BADGE_VARIANTS, type) ? BADGE_VARIANTS[type] : 'secondary'}
      className="whitespace-normal"
    >
      {hasOwnKey(BADGE_VARIANTS, type) ? t(`wasteCalendar.types.${type}`) : type}
    </Badge>
  );
}

export interface WasteCalendarComponentProps {
  readonly props: ComponentProps<'wasteCalendar'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** The earliest day (with every bin collected that day) and the days after it. */
function groupByNext(entries: readonly CollectionEntry[]) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (first === undefined) {
    return null;
  }
  return {
    date: first.date,
    next: sorted.filter((entry) => entry.date === first.date),
    later: sorted.filter((entry) => entry.date !== first.date),
  };
}

/** The next waste collections, colour-coded by waste type; the nearest one leads. */
export async function WasteCalendar({ props, context, loadContent }: WasteCalendarComponentProps) {
  const [t, format, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'WasteCollectionEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      additionalDatasetIds: props.additionalDatasetIds,
      category: props.district,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('wasteCalendar.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const groups = groupByNext(result.value.items);
  if (groups === null) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section tone="muted" className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <div className="max-w-[var(--civo-width-narrow)]">
          <div className={groups.later.length > 0 ? 'border-b border-border pb-6' : undefined}>
            <p className="text-sm font-medium text-copy-muted">{t('wasteCalendar.next')}</p>
            <time
              dateTime={groups.date}
              className="mt-1 block font-heading text-2xl text-copy tabular-nums sm:text-3xl"
            >
              {format.date(groups.date, LEAD_DATE_FORMAT)}
            </time>
            <ul className="mt-3 flex flex-col gap-2">
              {groups.next.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <WasteTypeBadge type={entry.wasteType} />
                  {entry.district !== undefined && (
                    <span className="text-sm text-copy-muted">{entry.district}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {groups.later.length > 0 && (
            <ul className="flex flex-col divide-y divide-border">
              {groups.later.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <time
                      dateTime={entry.date}
                      className="text-base font-medium text-copy tabular-nums"
                    >
                      {format.date(entry.date, ROW_DATE_FORMAT)}
                    </time>
                    {entry.district !== undefined && (
                      <p className="text-sm text-copy-muted">{entry.district}</p>
                    )}
                  </div>
                  <WasteTypeBadge type={entry.wasteType} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
      <ContentOriginBadge origin={result.value.origin} />
    </Section>
  );
}
