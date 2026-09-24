"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID_STROKE, TOOLTIP_STYLE, X_AXIS_LINE, Y_AXIS, useChartAnimation } from "../chart-style";
import { formatDate, formatNumber } from "@/lib/utils/formatters";

export type TrendDatum = { date: string; value: number };

/**
 * TrendChartClient — isolated "use client" leaf (spec §14), mirroring
 * metric-chart-client.tsx's pattern: the data-fetching Server Component
 * stays a Server Component, only the Recharts rendering needs the
 * browser. Uses an area chart (vs. metricChart's bar) since trend data
 * over time reads better as a continuous line/area than discrete bars.
 *
 * The gradient's id is generated per instance with useId(), not a fixed
 * string: two trend charts on one page (e.g. one inside DashboardGrid, one
 * standalone) previously both defined <linearGradient id="civoTrendFill">.
 * Browsers have no defined behavior for a duplicate id, and in practice this
 * silently blanked BOTH area fills AND an unrelated donut chart rendered
 * between them on the same page — confirmed in a real browser, not just a
 * theoretical SVG-spec concern.
 */
export function TrendChartClient({ data, unit }: { data: TrendDatum[]; unit?: string }) {
    const animate = useChartAnimation();
    const gradientId = `civoTrendFill-${useId()}`;

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--civo-chart-1)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--civo-chart-1)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => formatDate(new Date(value), "short")}
                        {...AXIS}
                        axisLine={X_AXIS_LINE}
                    />
                    <YAxis {...Y_AXIS} />
                    <Tooltip
                        formatter={(value) => [unit ? `${formatNumber(Number(value))} ${unit}` : formatNumber(Number(value)), ""]}
                        labelFormatter={(value) =>
                            typeof value === "string" ? formatDate(new Date(value), "short") : String(value ?? "")
                        }
                        contentStyle={TOOLTIP_STYLE}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--civo-chart-1)"
                        strokeWidth={2}
                        fill={`url(#${gradientId})`}
                        isAnimationActive={animate}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
