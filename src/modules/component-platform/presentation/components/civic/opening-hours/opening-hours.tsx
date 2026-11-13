import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';

import { getTranslations } from '@i18n/server';

import { cn, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface OpeningHoursComponentProps {
  readonly props: ComponentProps<'openingHours'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** A day with a midday break has one entry per period; they share one row, in source order. */
function byDay<T extends { readonly day: string }>(items: readonly T[]): Map<T['day'], T[]> {
  const days = new Map<T['day'], T[]>();
  for (const entry of items) {
    days.set(entry.day, [...(days.get(entry.day) ?? []), entry]);
  }
  return days;
}

/** The general opening hours, one row per weekday. */
export async function OpeningHours({ props, context, loadContent }: OpeningHoursComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'OpeningHoursEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('openingHours.defaultHeading');

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
        <Rail heading={heading} ratio="content-heavy">
          <dl className="max-w-[var(--civo-width-narrow)] divide-y divide-border border-y border-border">
            {[...byDay(items)].map(([day, entries]) => {
              const ranges = entries.flatMap((entry) =>
                entry.closed || entry.opensAt === undefined || entry.closesAt === undefined
                  ? []
                  : [t('openingHours.range', { from: entry.opensAt, to: entry.closesAt })],
              );

              return (
                <div key={day} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="text-copy">{t(`openingHours.days.${day}`)}</dt>
                  <dd
                    className={cn(
                      'text-end tabular-nums',
                      ranges.length === 0 ? 'text-copy-muted' : 'font-medium text-copy',
                    )}
                  >
                    {ranges.length === 0
                      ? t('openingHours.closed')
                      : ranges.map((range) => (
                          <span key={range} className="block">
                            {range}
                          </span>
                        ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Rail>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
