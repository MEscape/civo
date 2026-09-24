import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import type { SmartCityMetric } from "@/modules/content/domain/smartcity-types";

const getMetrics = vi.fn();
vi.mock("@/modules/integrations/smartcity/infrastructure/adapters", () => ({
    getSmartCityDataProvider: async () => ({ getMetrics }),
}));
const logError = vi.fn();
vi.mock("@/lib/logger/logger", () => ({ logger: { error: (...a: unknown[]) => logError(...a), warn: vi.fn(), info: vi.fn() } }));

import { KpiGrid } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/kpi-grid/kpi-grid";
import { DashboardGrid } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/dashboard-grid/dashboard-grid";
import { MetricChart } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-chart/metric-chart";
import { MetricComparisonChart } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-comparison-chart/metric-comparison-chart";
import { MetricDonut } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-donut/metric-donut";
import { MetricGauge } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-gauge/metric-gauge";
import { MetricTable } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-table/metric-table";
import { MetricTrendChart } from "../../../../../../../../Downloads/civo-changes/src/modules/integrations/smartcity/components/metric-trend-chart/metric-trend-chart";

type Widget = (args: { props: Record<string, unknown>; editMode?: boolean }) => Promise<React.ReactElement | null>;

const WIDGETS: Array<[string, Widget]> = [
    ["KpiGrid", KpiGrid as Widget],
    ["DashboardGrid", DashboardGrid as Widget],
    ["MetricChart", MetricChart as Widget],
    ["MetricComparisonChart", MetricComparisonChart as Widget],
    ["MetricDonut", MetricDonut as Widget],
    ["MetricGauge", MetricGauge as Widget],
    ["MetricTable", MetricTable as Widget],
    ["MetricTrendChart", MetricTrendChart as Widget],
];

/** Has everything any widget needs: a series, a breakdown and a target. */
const FULL: SmartCityMetric[] = [
    {
        id: "kpi-1",
        label: "CO₂-Reduktion",
        value: 18.4,
        unit: "%",
        trend: "up",
        changePercent: 3.1,
        target: 25,
        series: [{ date: "2024-01", value: 12 }, { date: "2024-04", value: 18 }],
        breakdown: [{ label: "Verkehr", value: 45 }, { label: "Gebäude", value: 55 }],
        source: "Stadtwerke Demo",
    },
];
/** Valid metrics with none of series/breakdown/target: fine for grids, empty for the specialised charts. */
const PLAIN: SmartCityMetric[] = [{ id: "kpi-2", label: "Radverkehrsanteil", value: 27, unit: "%" }];

async function renderWidget(widget: Widget) {
    const ui = await widget({ props: {} });
    return render(<>{ui}</>);
}

describe.each(WIDGETS)("%s", (name, widget) => {
    beforeEach(() => {
        getMetrics.mockReset();
        logError.mockReset();
    });

    it("explains a data failure instead of vanishing, keeps its heading, and logs the cause server-side", async () => {
        getMetrics.mockResolvedValue(err(AppErrors.internal(new Error("upstream timeout 503"))));
        const { container } = await renderWidget(widget);

        expect(container.querySelector('[data-widget-state="error"]'), `${name} error state`).not.toBeNull();
        expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
        expect(logError).toHaveBeenCalledTimes(1);
        // The reader sees plain words, never the cause.
        expect(container.textContent).not.toMatch(/timeout|503|upstream|Error/);
    });

    it("says there is no data, in different words from an error, when the source returns nothing usable", async () => {
        // An empty list is empty for every widget. Metrics without series/breakdown/target
        // are additionally empty for the specialised charts, so check that shape too.
        getMetrics.mockResolvedValue(ok([]));
        const empty = await renderWidget(widget);
        expect(empty.container.querySelector('[data-widget-state="empty"]'), `${name} empty list`).not.toBeNull();
        expect(empty.container.querySelector('[data-widget-state="error"]')).toBeNull();
    });

    it("renders normally, with no fallback state, when data is present", async () => {
        getMetrics.mockResolvedValue(ok(FULL));
        const { container } = await renderWidget(widget);
        expect(container.querySelector("[data-widget-state]"), `${name} healthy`).toBeNull();
        expect(container.textContent).toContain("Quelle: Stadtwerke Demo");
    });
});

describe("specialised charts with metrics that lack the field they plot", () => {
    beforeEach(() => getMetrics.mockReset());

    it.each([
        ["MetricDonut", MetricDonut as Widget],
        ["MetricTrendChart", MetricTrendChart as Widget],
        ["MetricGauge", MetricGauge as Widget],
    ])("%s shows the empty state rather than a blank section", async (name, widget) => {
        getMetrics.mockResolvedValue(ok(PLAIN));
        const { container } = await renderWidget(widget);
        expect(container.querySelector('[data-widget-state="empty"]'), name).not.toBeNull();
    });

    it("a gauge whose target is 0 is empty, not a divide-by-zero", async () => {
        getMetrics.mockResolvedValue(ok([{ ...FULL[0], target: 0 }]));
        const { container } = await renderWidget(MetricGauge as Widget);
        expect(container.querySelector('[data-widget-state="empty"]')).not.toBeNull();
        expect(container.textContent).not.toMatch(/Infinity|NaN/);
    });
});
