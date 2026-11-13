import type { Locale } from '@i18n';

import { cn } from '@lib/utils';

import { todayBar } from '../../forms/resource-today-bar';
import { createZonedFormat } from '../../hooks/use-zoned-format';
import { OPEN_FILL } from '../shared/hours-swatch';

import type { ResourceTodayDto } from '../../dto/resource-dto';
import type { BookingTranslator } from '../../translation/translator';

export interface ResourceTodayProps {
  readonly locale: Locale;
  readonly t: BookingTranslator;
  readonly today: ResourceTodayDto;
  readonly places: number;
}

/** What the free time of the opening hours looks like: the tint of the open fill, so the bar shows even on a day with no use. */
const FREE_FILL = 'bg-primary/15';

/**
 * How a resource is used today, on its location's clock, drawn like a day of the opening hours: the
 * track is the opening hours (in the open fill's light tint, so an unused day is still a visible bar),
 * the stretches in use sit on it in the solid fill, and full ones in the warning colour. Beneath it the
 * same in words: the peak and every stretch, so a full room is never told by colour alone. The bar
 * only repeats the words.
 */
export function ResourceToday({ locale, t, today, places }: ResourceTodayProps) {
  const format = createZonedFormat(locale);
  const bar = todayBar(today, format.timeRange);
  if (bar === null || today.window === null) {
    return <p className="text-sm text-copy-muted">{t('resources.today.closed')}</p>;
  }
  const { start, end } = today.window;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div
          aria-hidden="true"
          dir="ltr"
          className={cn('relative h-10 rounded-token-sm', FREE_FILL)}
        >
          {bar.segments.map((segment) => (
            <span
              key={segment.key}
              title={segment.hours}
              className={cn(
                'absolute inset-y-1 rounded-token-sm',
                segment.isFull ? 'bg-warning' : OPEN_FILL,
              )}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          dir="ltr"
          className="flex justify-between text-xs tabular-nums text-copy-muted"
        >
          <span>{format.time(start, today.timeZone)}</span>
          <span>{format.time(end, today.timeZone)}</span>
        </div>
      </div>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-copy-muted">
        <li className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-5 rounded-full', FREE_FILL)} />
          {t('resources.today.legendFree')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-5 rounded-full', OPEN_FILL)} />
          {t('resources.today.legendInUse')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-warning" />
          {t('resources.today.legendFull')}
        </li>
      </ul>
      <p className="text-sm text-copy">
        {today.peak === 0
          ? `${t('resources.today.free')} · ${bar.hours}`
          : t('resources.today.peak', { peak: today.peak, places, hours: bar.hours })}
      </p>
      {bar.segments.length > 0 && (
        <ul className="space-y-0.5 text-xs text-copy-muted">
          {bar.segments.map((segment) => (
            <li key={segment.key}>
              {segment.isFull
                ? t('resources.today.full', { hours: segment.hours })
                : t('resources.today.inUse', { hours: segment.hours })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
