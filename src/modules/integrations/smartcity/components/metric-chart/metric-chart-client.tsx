"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type MetricChartDatum = {
    label: string;
    value: number;
};

/**
 * The actual chart rendering — isolated in its own "use client" module so
 * the server component that fetches data (metric-chart.tsx) stays a
 * Server Component. Recharts requires a browser environment (measuring
 * container size, etc), so this boundary is kept as small as possible
 * per spec §14.
 */
export function MetricChartClient({ data }: { data: MetricChartDatum[] }) {
    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--civo-color-border)" vertical={false} />
                    <XAxis
                        dataKey="label"
                        stroke="var(--civo-color-text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: "var(--civo-color-border)" }}
                    />
                    <YAxis
                        stroke="var(--civo-color-text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--civo-color-surface)",
                            border: "1px solid var(--civo-color-border)",
                            borderRadius: "var(--civo-radius)",
                            fontSize: 13,
                        }}
                        cursor={{ fill: "var(--civo-color-background)" }}
                    />
                    <Bar dataKey="value" fill="var(--civo-color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
