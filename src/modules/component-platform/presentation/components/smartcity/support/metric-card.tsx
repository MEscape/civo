import { Card, CardContent } from '@components/ui/card';

import { getAppFormatters } from '@i18n/server';

import { TrendIndicator } from './trend-indicator';

import type { TrendDirection } from './trend-indicator';

export interface MetricCardData {
  readonly label: string;
  readonly value: number;
  readonly unit?: string | undefined;
  readonly trend?: TrendDirection | undefined;
  readonly changePercent?: number | undefined;
}

const SIZES = {
  regular: { value: 'text-3xl', unit: 'text-sm', trend: 'mt-2 text-xs' },
  compact: { value: 'text-2xl', unit: 'text-xs', trend: 'mt-1 text-xs' },
} as const;

export interface MetricCardProps {
  readonly metric: MetricCardData;
  readonly size?: keyof typeof SIZES;
}

export async function MetricCard({ metric, size = 'regular' }: MetricCardProps) {
  const fmt = await getAppFormatters();
  const sizes = SIZES[size];

  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm text-copy-muted">{metric.label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`font-heading text-primary-copy ${sizes.value}`}>
            {fmt.number(metric.value)}
          </span>
          {metric.unit !== undefined && (
            <span className={`text-copy-muted ${sizes.unit}`}>{metric.unit}</span>
          )}
        </div>
        {metric.trend !== undefined && metric.changePercent !== undefined && (
          <TrendIndicator
            trend={metric.trend}
            changePercent={metric.changePercent}
            className={sizes.trend}
          />
        )}
      </CardContent>
    </Card>
  );
}
