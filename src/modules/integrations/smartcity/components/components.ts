import type { ComponentDefinition } from "@/modules/component-platform/domain/types";
import { kpiGridDefinition } from "./kpi-grid/kpi-grid.definition";
import { metricChartDefinition } from "./metric-chart/metric-chart.definition";
import { metricTrendChartDefinition } from "./metric-trend-chart/metric-trend-chart.definition";
import { metricComparisonChartDefinition } from "./metric-comparison-chart/metric-comparison-chart.definition";
import { metricDonutDefinition } from "./metric-donut/metric-donut.definition";
import { metricGaugeDefinition } from "./metric-gauge/metric-gauge.definition";
import { metricTableDefinition } from "./metric-table/metric-table.definition";
import { dashboardGridDefinition } from "./dashboard-grid/dashboard-grid.definition";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const smartcityComponents: ComponentDefinition<any>[] = [
    kpiGridDefinition,
    metricChartDefinition,
    metricTrendChartDefinition,
    metricComparisonChartDefinition,
    metricDonutDefinition,
    metricGaugeDefinition,
    metricTableDefinition,
    dashboardGridDefinition,
];
