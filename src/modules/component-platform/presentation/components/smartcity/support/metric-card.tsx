import { getAppFormatters, getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { TrendIndicator } from './trend-indicator';

import type { TrendDirection } from './trend-indicator';

export interface MetricCardData {
  readonly label: string;
  readonly value: number;
  readonly unit?: string | undefined;
  readonly trend?: TrendDirection | undefined;
  readonly changePercent?: number | undefined;
  readonly observedAt?: string | undefined;
}

const SIZES = {
  regular: { value: 'text-4xl', unit: 'text-base', trend: 'mt-2' },
  compact: { value: 'text-3xl', unit: 'text-sm', trend: 'mt-1' },
} as const;

export interface MetricCardProps {
  readonly metric: MetricCardData;
  readonly size?: keyof typeof SIZES;
}

/** One key figure: a small label over a large number, set on a hairline instead of in a box. */
export async function MetricCard({ metric, size = 'regular' }: MetricCardProps) {
  const [fmt, t] = await Promise.all([getAppFormatters(), getTranslations('componentPlatform')]);
  const sizes = SIZES[size];

  return (
    <dl className="border-t border-border pt-4">
      <dt className="text-sm text-copy-muted [overflow-wrap:anywhere]">{metric.label}</dt>
      <dd className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className={cn('font-heading text-primary-copy tabular-nums', sizes.value)}>
          {fmt.number(metric.value)}
        </span>
        {metric.unit !== undefined && (
          <span className={cn('text-copy-muted', sizes.unit)}>{metric.unit}</span>
        )}
      </dd>
      {metric.observedAt !== undefined && (
        <dd className="mt-2 text-sm text-copy-muted">
          {t('provenance.measuredAt')}{' '}
          <time dateTime={metric.observedAt}>{fmt.dateTime(metric.observedAt)}</time>
        </dd>
      )}
      {metric.trend !== undefined && metric.changePercent !== undefined && (
        <dd>
          <TrendIndicator
            trend={metric.trend}
            changePercent={metric.changePercent}
            className={sizes.trend}
          />
        </dd>
      )}
    </dl>
  );
}
