import type { ComponentType } from "react";
import type { PageComponentProps } from "@/modules/component-platform/domain";

// Civic
import { AlertBanner } from "@/modules/integrations/civic/components/alert-banner/alert-banner";
import { ContactCard } from "@/modules/integrations/civic/components/contact-card/contact-card";
import { CouncilBlock } from "@/modules/integrations/civic/components/council-block/council-block";
import { DepartmentDirectory } from "@/modules/integrations/civic/components/department-directory/department-directory";
import { EventsGrid } from "@/modules/integrations/civic/components/events-grid/events-grid";
import { LocationPlaceholder } from "@/modules/integrations/civic/components/location-placeholder/location-placeholder";
import { NewsAndEventsSplit } from "@/modules/integrations/civic/components/news-and-events-split/news-and-events-split";
import { NewsGrid } from "@/modules/integrations/civic/components/news-grid/news-grid";
import { OpeningHours } from "@/modules/integrations/civic/components/opening-hours/opening-hours";
import { QuickLinks } from "@/modules/integrations/civic/components/quick-links/quick-links";
import { ServiceFinder } from "@/modules/integrations/civic/components/service-finder/service-finder";
import { ServiceGrid } from "@/modules/integrations/civic/components/service-grid/service-grid";
import { WasteCalendar } from "@/modules/integrations/civic/components/waste-calendar/waste-calendar";

// Content
import { AccordionBlock } from "@/modules/builder/components/standard/accordion-block/accordion-block";
import { CallToAction } from "@/modules/builder/components/standard/call-to-action/call-to-action";
import { CardGrid } from "@/modules/builder/components/standard/card-grid/card-grid";
import { Hero } from "@/modules/builder/components/standard/hero/hero";
import { RichText } from "@/modules/builder/components/standard/rich-text/rich-text";
import { TabsBlock } from "@/modules/builder/components/standard/tabs-block/tabs-block";

// Layout
import { SectionNode } from "@/modules/builder/components/layout/section/section";

// SmartCity
import { DashboardGrid } from "@/modules/integrations/smartcity/components/dashboard-grid/dashboard-grid";
import { KpiGrid } from "@/modules/integrations/smartcity/components/kpi-grid/kpi-grid";
import { MetricChart } from "@/modules/integrations/smartcity/components/metric-chart/metric-chart";
import { MetricComparisonChart } from "@/modules/integrations/smartcity/components/metric-comparison-chart/metric-comparison-chart";
import { MetricDonut } from "@/modules/integrations/smartcity/components/metric-donut/metric-donut";
import { MetricGauge } from "@/modules/integrations/smartcity/components/metric-gauge/metric-gauge";
import { MetricTable } from "@/modules/integrations/smartcity/components/metric-table/metric-table";
import { MetricTrendChart } from "@/modules/integrations/smartcity/components/metric-trend-chart/metric-trend-chart";

// Skeletons
import { DashboardGridSkeleton } from "@/modules/integrations/smartcity/components/dashboard-grid/dashboard-grid.skeleton";
import { KpiGridSkeleton } from "@/modules/integrations/smartcity/components/kpi-grid/kpi-grid.skeleton";
import { MetricChartSkeleton } from "@/modules/integrations/smartcity/components/metric-chart/metric-chart.skeleton";
import { MetricComparisonChartSkeleton } from "@/modules/integrations/smartcity/components/metric-comparison-chart/metric-comparison-chart.skeleton";
import { MetricDonutSkeleton } from "@/modules/integrations/smartcity/components/metric-donut/metric-donut.skeleton";
import { MetricGaugeSkeleton } from "@/modules/integrations/smartcity/components/metric-gauge/metric-gauge.skeleton";
import { MetricTableSkeleton } from "@/modules/integrations/smartcity/components/metric-table/metric-table.skeleton";
import { MetricTrendChartSkeleton } from "@/modules/integrations/smartcity/components/metric-trend-chart/metric-trend-chart.skeleton";
import { NewsGridSkeleton } from "@/modules/integrations/civic/components/news-grid/news-grid.skeleton";
import { EventsGridSkeleton } from "@/modules/integrations/civic/components/events-grid/events-grid.skeleton";
import { ServiceGridSkeleton } from "@/modules/integrations/civic/components/service-grid/service-grid.skeleton";
import { NewsAndEventsSplitSkeleton } from "@/modules/integrations/civic/components/news-and-events-split/news-and-events-split.skeleton";

export const componentMap: Record<string, ComponentType<PageComponentProps>> = {
    // Civic
    "alertBanner": AlertBanner as ComponentType<PageComponentProps>,
    "contactCard": ContactCard as ComponentType<PageComponentProps>,
    "councilBlock": CouncilBlock as ComponentType<PageComponentProps>,
    "departmentDirectory": DepartmentDirectory as ComponentType<PageComponentProps>,
    "eventsGrid": EventsGrid as ComponentType<PageComponentProps>,
    "locationPlaceholder": LocationPlaceholder as ComponentType<PageComponentProps>,
    "newsAndEventsSplit": NewsAndEventsSplit as ComponentType<PageComponentProps>,
    "newsGrid": NewsGrid as ComponentType<PageComponentProps>,
    "openingHours": OpeningHours as ComponentType<PageComponentProps>,
    "quickLinks": QuickLinks as ComponentType<PageComponentProps>,
    "serviceFinder": ServiceFinder as ComponentType<PageComponentProps>,
    "serviceGrid": ServiceGrid as ComponentType<PageComponentProps>,
    "wasteCalendar": WasteCalendar as ComponentType<PageComponentProps>,

    // Content
    "accordion": AccordionBlock as ComponentType<PageComponentProps>,
    "callToAction": CallToAction as ComponentType<PageComponentProps>,
    "cardGrid": CardGrid as ComponentType<PageComponentProps>,
    "hero": Hero as ComponentType<PageComponentProps>,
    "richText": RichText as ComponentType<PageComponentProps>,
    "tabs": TabsBlock as ComponentType<PageComponentProps>,

    // Layout
    "section": SectionNode as ComponentType<PageComponentProps>,

    // SmartCity
    "dashboardGrid": DashboardGrid as ComponentType<PageComponentProps>,
    "kpiGrid": KpiGrid as ComponentType<PageComponentProps>,
    "metricChart": MetricChart as ComponentType<PageComponentProps>,
    "metricComparisonChart": MetricComparisonChart as ComponentType<PageComponentProps>,
    "metricDonut": MetricDonut as ComponentType<PageComponentProps>,
    "metricGauge": MetricGauge as ComponentType<PageComponentProps>,
    "metricTable": MetricTable as ComponentType<PageComponentProps>,
    "metricTrendChart": MetricTrendChart as ComponentType<PageComponentProps>,
};

export const skeletonMap: Record<string, ComponentType> = {
    "dashboardGrid": DashboardGridSkeleton,
    "kpiGrid": KpiGridSkeleton,
    "metricChart": MetricChartSkeleton,
    "metricComparisonChart": MetricComparisonChartSkeleton,
    "metricDonut": MetricDonutSkeleton,
    "metricGauge": MetricGaugeSkeleton,
    "metricTable": MetricTableSkeleton,
    "metricTrendChart": MetricTrendChartSkeleton,
    "newsGrid": NewsGridSkeleton,
    "eventsGrid": EventsGridSkeleton,
    "serviceGrid": ServiceGridSkeleton,
    "newsAndEventsSplit": NewsAndEventsSplitSkeleton,
};
