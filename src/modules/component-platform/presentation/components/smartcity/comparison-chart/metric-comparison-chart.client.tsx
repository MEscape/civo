'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_COLORS,
  CHART_SERIES_COLORS,
  TOOLTIP_STYLE,
} from '../support/chart-theme';

export interface ComparisonDatum {
  readonly label: string;
  readonly value: number;
  readonly target: number;
}

export interface ComparisonChartLabels {
  readonly actual: string;
  readonly target: string;
}

export interface MetricComparisonChartClientProps {
  readonly data: readonly ComparisonDatum[];
  readonly labels: ComparisonChartLabels;
}

/** Grouped bars: current value against target for several goals. */
export function MetricComparisonChartClient({ data, labels }: MetricComparisonChartClientProps) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
          />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: CHART_COLORS.background }} />
          <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />
          <Bar
            dataKey="value"
            name={labels.actual}
            fill={CHART_SERIES_COLORS[0]}
            radius={BAR_RADIUS}
          />
          <Bar
            dataKey="target"
            name={labels.target}
            fill={CHART_SERIES_COLORS[1]}
            radius={BAR_RADIUS}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
