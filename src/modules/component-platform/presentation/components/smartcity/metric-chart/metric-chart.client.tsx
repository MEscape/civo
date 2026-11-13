'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_COLORS,
  TOOLTIP_STYLE,
} from '@components/ui/chart-theme';

import { useAppFormatters } from '@i18n/client';

export interface MetricChartDatum {
  readonly label: string;
  readonly value: number;
}

/**
 * The chart itself, isolated in its own client module so the component that
 * loads the data stays a Server Component (Recharts needs the browser).
 */
export function MetricChartClient({ data }: { readonly data: readonly MetricChartDatum[] }) {
  const fmt = useAppFormatters();

  // Takes only the value: Recharts also passes the tick index, which must
  // not land in fmt.number's `options` parameter.
  const formatTick = (value: number): string => fmt.number(value);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          accessibilityLayer={false}
          data={[...data]}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
          />
          <YAxis
            tickFormatter={formatTick}
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={false}
            // Measured from the tick labels, so six-digit values are not clipped.
            width="auto"
          />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number' ? formatTick(value) : String(value),
              '',
            ]}
            separator=""
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: CHART_COLORS.background }}
          />
          <Bar dataKey="value" fill={CHART_COLORS.primary} radius={BAR_RADIUS} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
