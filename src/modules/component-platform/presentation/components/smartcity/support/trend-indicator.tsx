import { Minus, TrendingDown, TrendingUp } from '@components/icons/icons';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

export type TrendDirection = 'up' | 'down' | 'flat';

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
} as const;

const PERCENT = 100;

export interface TrendIndicatorProps {
  readonly trend: TrendDirection;
  /** In percent points, e.g. 3.2 for 3.2 %. */
  readonly changePercent: number;
  /** Layout from the caller (spacing, `inline-flex`); the type size is set here. */
  readonly className?: string;
}

/**
 * The change of a figure. The direction is told by the icon's shape and by a
 * spoken word ("increased"), never by colour: there is none, on purpose,
 * because "up" is not always good news.
 */
export async function TrendIndicator({ trend, changePercent, className }: TrendIndicatorProps) {
  const [t, fmt] = await Promise.all([getTranslations('componentPlatform'), getAppFormatters()]);
  const Icon = TREND_ICONS[trend];

  return (
    <div
      className={cn('flex items-center gap-1.5 text-sm text-copy-muted tabular-nums', className)}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="sr-only">{t(`trendIndicator.${trend}`)}: </span>
        {fmt.percent(Math.abs(changePercent) / PERCENT, 1)}
      </span>
    </div>
  );
}
