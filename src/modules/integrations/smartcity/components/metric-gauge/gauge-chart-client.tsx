"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { useChartAnimation } from "../chart-style";
import {formatShare} from "@/lib/utils/formatters";

/**
 * GaugeChartClient — single-value progress-to-target gauge (spec: Smart
 * City viz batch), e.g. "62% toward 2030 CO2 goal". Uses Recharts'
 * RadialBarChart rather than a hand-rolled SVG arc, keeping this
 * consistent with the "well-supported React charting solution" spec
 * requirement instead of a bespoke gauge implementation.
 *
 * The ring stops at 100%, but the printed figure does not: a target
 * exceeded by 20% must read "120 %", not "100 %".
 */
export function GaugeChartClient({ percent }: { percent: number }) {
    const animate = useChartAnimation();
    const clamped = Math.max(0, Math.min(100, percent));
    const data = [{ name: "progress", value: clamped, fill: "var(--civo-chart-1)" }];

    return (
        <div className="relative h-56 w-56">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={16}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    {/* Track is the border color: --civo-color-surface is also the muted section's own background, which made the empty part of the ring invisible. */}
                    <RadialBar
                        dataKey="value"
                        cornerRadius={8}
                        background={{ fill: "var(--civo-color-border)" }}
                        isAnimationActive={animate}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-3xl text-primary-copy">{formatShare(Math.max(0, percent) / 100)}</span>
                <span className="text-xs text-copy-muted">zum Ziel</span>
            </div>
        </div>
    );
}
