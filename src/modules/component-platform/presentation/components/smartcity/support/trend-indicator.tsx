import { Minus, TrendingDown, TrendingUp } from '@components/ui/icons';

import { getAppFormatters } from '@i18n/server';

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
  readonly className?: string;
}

export async function TrendIndicator({
  trend,
  changePercent,
  className = 'mt-2 text-xs',
}: TrendIndicatorProps) {
  const fmt = await getAppFormatters();
  const Icon = TREND_ICONS[trend];

  return (
    <div className={`flex items-center gap-1 text-copy-muted ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{fmt.percent(Math.abs(changePercent) / PERCENT, 1)}</span>
    </div>
  );
}
