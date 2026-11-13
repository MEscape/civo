'use client';

import { useId } from 'react';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AXIS_FONT_SIZE, CHART_COLORS, TOOLTIP_STYLE } from '@components/ui/chart-theme';

import { useAppFormatters } from '@i18n/client';

import { formatTrendDate, trendAxisFormat } from './trend-time-format';

export interface TrendDatum {
  readonly date: string;
  readonly value: number;
}

export interface MetricTrendChartClientProps {
  readonly resolution?: string | undefined;
  readonly data: readonly TrendDatum[];
  readonly unit?: string | undefined;
}

/** Area chart of a metric over time; an isolated client leaf. */
export function MetricTrendChartClient({ data, unit, resolution }: MetricTrendChartClientProps) {
  const fmt = useAppFormatters();

  // Unique per instance: two charts on one page must not share an SVG id.
  // useId output contains characters (":", "«", "»") that are not safe
  // inside url(#...), so strip everything except letters, digits, _ and -.
  const gradientId = `trendFill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const axisFormat = trendAxisFormat(data, resolution);
  const formatInstant = (value: string): string =>
    formatTrendDate(value, fmt, { resolution, format: axisFormat });

  const formatValue = (value: unknown): string => {
    const text = typeof value === 'number' ? fmt.number(value) : String(value);
    return unit === undefined ? text : `${text} ${unit}`;
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          accessibilityLayer={false}
          data={[...data]}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatInstant}
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
          />
          <YAxis
            tickFormatter={(value: number) => fmt.number(value)}
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={false}
            // Measured from the tick labels, so six-digit values are not clipped.
            width="auto"
          />
          <Tooltip
            formatter={(value) => [formatValue(value), '']}
            labelFormatter={(value) =>
              typeof value === 'string' ? formatTrendDate(value, fmt, { resolution }) : value
            }
            contentStyle={TOOLTIP_STYLE}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
