"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/utils/formatters";

export type TrendDatum = { date: string; value: number };

/**
 * TrendChartClient — isolated "use client" leaf (spec §14), mirroring
 * metric-chart-client.tsx's pattern: the data-fetching Server Component
 * stays a Server Component, only the Recharts rendering needs the
 * browser. Uses an area chart (vs. metricChart's bar) since trend data
 * over time reads better as a continuous line/area than discrete bars.
 */
export function TrendChartClient({ data, unit }: { data: TrendDatum[]; unit?: string }) {
    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="civoTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--civo-color-primary)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="var(--civo-color-primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--civo-color-border)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => formatDate(new Date(value), "short")}
                        stroke="var(--civo-color-text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: "var(--civo-color-border)" }}
                    />
                    <YAxis stroke="var(--civo-color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                        formatter={(value) => [unit ? `${value} ${unit}` : String(value ?? ""), ""]}
                        labelFormatter={(value) =>
                            typeof value === "string" ? formatDate(new Date(value), "short") : String(value ?? "")
                        }
                        contentStyle={{
                            background: "var(--civo-color-surface)",
                            border: "1px solid var(--civo-color-border)",
                            borderRadius: "var(--civo-radius)",
                            fontSize: 13,
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--civo-color-primary)"
                        strokeWidth={2}
                        fill="url(#civoTrendFill)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
