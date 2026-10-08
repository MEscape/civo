import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';
import { Card, CardContent } from '@components/ui/card';
import { Trash2 } from '@components/ui/icons';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  WASTE_TYPES,
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

type WasteKind = (typeof WASTE_TYPES)[number];

const BADGE_VARIANTS = {
  restmuell: 'muted',
  biomuell: 'default',
  papier: 'muted',
  gelberSack: 'warning',
  sperrmuell: 'warning',
} as const satisfies Record<WasteKind, 'default' | 'muted' | 'warning'>;

const DATE_FORMAT = {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
} as const;

export interface WasteCalendarComponentProps {
  readonly props: ComponentProps<'wasteCalendar'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** The next waste collections, colour-coded by waste type. */
export async function WasteCalendar({ props, context, loadContent }: WasteCalendarComponentProps) {
  const [t, format, result] = await Promise.all([
    getTranslations('componentPlatform'),
    getAppFormatters(),
    loadContent({
      kind: 'WasteCollectionEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      category: props.district,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('wasteCalendar.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items: entries, origin } = result.value;
  if (entries.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section tone="muted" className="relative">
      <ContentOriginBadge origin={origin} />
      <Container className="max-w-2xl">
        <SectionHeading>{heading}</SectionHeading>
        <Card>
          <CardContent className="pt-5">
            <ul className="flex flex-col divide-y divide-border">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-4 w-4 shrink-0 text-copy-muted" aria-hidden="true" />
                    <div>
                      <time dateTime={entry.date} className="text-copy">
                        {format.date(entry.date, DATE_FORMAT)}
                      </time>
                      {entry.district !== undefined && (
                        <p className="text-xs text-copy-muted">{entry.district}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={BADGE_VARIANTS[entry.wasteType]}>
                    {t(`wasteCalendar.types.${entry.wasteType}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Container>
    </Section>
  );
}
