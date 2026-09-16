"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ComparisonDatum = { label: string; value: number; target?: number };

/**
 * ComparisonChartClient — grouped bar chart comparing current value
 * against target across several metrics at once (spec: Smart City viz
 * batch). Distinct from the existing single-series metric-chart-client:
 * this always renders two series (value vs. target) side by side, which
 * is the "comparison" the component name promises rather than a plain
 * bar chart with a different data source.
 */
export function ComparisonChartClient({ data }: { data: ComparisonDatum[] }) {
    const hasTargets = data.some((d) => d.target !== undefined);

    return (
        <div className="h-80 w-full">
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
                    <YAxis stroke="var(--civo-color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                        contentStyle={{
                            background: "var(--civo-color-surface)",
                            border: "1px solid var(--civo-color-border)",
                            borderRadius: "var(--civo-radius)",
                            fontSize: 13,
                        }}
                        cursor={{ fill: "var(--civo-color-background)" }}
                    />
                    {hasTargets && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    <Bar dataKey="value" name="Ist-Wert" fill="var(--civo-color-primary)" radius={[4, 4, 0, 0]} />
                    {hasTargets && (
                        <Bar dataKey="target" name="Zielwert" fill="var(--civo-color-accent)" radius={[4, 4, 0, 0]} />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
