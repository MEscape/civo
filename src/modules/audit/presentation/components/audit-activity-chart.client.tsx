'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  AXIS_FONT_SIZE,
  BAR_RADIUS,
  CHART_COLORS,
  CHART_SERIES_COLORS,
  TOOLTIP_STYLE,
} from '@components/ui/chart-theme';

/** One day, its texts already translated and formatted on the server. */
export interface ActivityDay {
  readonly day: string;
  /** The axis label, e.g. "12 Oct". */
  readonly label: string;
  /** What the tooltip says, e.g. "12 Oct 2026: 5 entries, 1 warning". */
  readonly summary: string;
  /** Entries that are not warnings: the two parts stack to the day's total. */
  readonly others: number;
  readonly warnings: number;
}

export interface AuditActivityChartProps {
  readonly days: readonly ActivityDay[];
  readonly names: { readonly others: string; readonly warnings: string };
}

/** What the chart hands its tooltip: the hovered bars, each carrying its day. */
interface DayTooltipProps {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{ readonly payload?: ActivityDay }>;
}

/** The day's sentence, not one number per series: the counts are read, the colors only point. */
function DayTooltip({ active, payload }: DayTooltipProps) {
  const day = payload?.[0]?.payload;
  if (!active || day === undefined) {
    return null;
  }
  return (
    <p style={TOOLTIP_STYLE} className="px-2 py-1">
      {day.summary}
    </p>
  );
}

/**
 * Entries per day over the last month, warnings stacked on top in the
 * warning color. Decorative for assistive technology: the card states the
 * totals in text and carries the same numbers as a table.
 */
export function AuditActivityChart({ days, names }: AuditActivityChartProps) {
  return (
    <div aria-hidden="true" className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={[...days]}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid stroke={CHART_COLORS.border} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.border }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            stroke={CHART_COLORS.muted}
            fontSize={AXIS_FONT_SIZE}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip content={<DayTooltip />} cursor={{ fill: CHART_COLORS.background }} />
          <Bar
            dataKey="others"
            name={names.others}
            stackId="day"
            fill={CHART_SERIES_COLORS[0]}
            stroke={CHART_COLORS.surface}
            radius={BAR_RADIUS}
          />
          <Bar
            dataKey="warnings"
            name={names.warnings}
            stackId="day"
            fill={CHART_COLORS.warning}
            stroke={CHART_COLORS.surface}
            radius={BAR_RADIUS}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
