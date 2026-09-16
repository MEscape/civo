import { z } from "zod";

export const smartCityMetricSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.number(),
    unit: z.string().optional(),
    category: z.enum(["sustainability", "mobility", "energy", "other"]).optional(),
    trend: z.enum(["up", "down", "flat"]).optional(),
    changePercent: z.number().optional(),
    series: z.array(z.object({ date: z.string(), value: z.number() })).optional(),
    breakdown: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
    target: z.number().optional(),
});

export const smartCityMetricListSchema = z.array(smartCityMetricSchema);
