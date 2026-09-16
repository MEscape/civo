import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { PageComponentProps } from "@/modules/component-platform/domain";

export const componentMap: Record<string, ComponentType<PageComponentProps>> = {
    // Civic
    "alertBanner": dynamic(() => import("@/modules/integrations/civic/components/alert-banner/alert-banner").then(mod => mod.AlertBanner as ComponentType<PageComponentProps>)),
    "contactCard": dynamic(() => import("@/modules/integrations/civic/components/contact-card/contact-card").then(mod => mod.ContactCard as ComponentType<PageComponentProps>)),
    "councilBlock": dynamic(() => import("@/modules/integrations/civic/components/council-block/council-block").then(mod => mod.CouncilBlock as ComponentType<PageComponentProps>)),
    "departmentDirectory": dynamic(() => import("@/modules/integrations/civic/components/department-directory/department-directory").then(mod => mod.DepartmentDirectory as ComponentType<PageComponentProps>)),
    "eventsGrid": dynamic(() => import("@/modules/integrations/civic/components/events-grid/events-grid").then(mod => mod.EventsGrid as ComponentType<PageComponentProps>)),
    "locationPlaceholder": dynamic(() => import("@/modules/integrations/civic/components/location-placeholder/location-placeholder").then(mod => mod.LocationPlaceholder as ComponentType<PageComponentProps>)),
    "newsAndEventsSplit": dynamic(() => import("@/modules/integrations/civic/components/news-and-events-split/news-and-events-split").then(mod => mod.NewsAndEventsSplit as ComponentType<PageComponentProps>)),
    "newsGrid": dynamic(() => import("@/modules/integrations/civic/components/news-grid/news-grid").then(mod => mod.NewsGrid as ComponentType<PageComponentProps>)),
    "openingHours": dynamic(() => import("@/modules/integrations/civic/components/opening-hours/opening-hours").then(mod => mod.OpeningHours as ComponentType<PageComponentProps>)),
    "quickLinks": dynamic(() => import("@/modules/integrations/civic/components/quick-links/quick-links").then(mod => mod.QuickLinks as ComponentType<PageComponentProps>)),
    "serviceFinder": dynamic(() => import("@/modules/integrations/civic/components/service-finder/service-finder").then(mod => mod.ServiceFinder as ComponentType<PageComponentProps>)),
    "serviceGrid": dynamic(() => import("@/modules/integrations/civic/components/service-grid/service-grid").then(mod => mod.ServiceGrid as ComponentType<PageComponentProps>)),
    "wasteCalendar": dynamic(() => import("@/modules/integrations/civic/components/waste-calendar/waste-calendar").then(mod => mod.WasteCalendar as ComponentType<PageComponentProps>)),

    // Content
    "accordion": dynamic(() => import("@/modules/builder/components/standard/accordion-block/accordion-block").then(mod => mod.AccordionBlock as ComponentType<PageComponentProps>)),
    "callToAction": dynamic(() => import("@/modules/builder/components/standard/call-to-action/call-to-action").then(mod => mod.CallToAction as ComponentType<PageComponentProps>)),
    "cardGrid": dynamic(() => import("@/modules/builder/components/standard/card-grid/card-grid").then(mod => mod.CardGrid as ComponentType<PageComponentProps>)),
    "hero": dynamic(() => import("@/modules/builder/components/standard/hero/hero").then(mod => mod.Hero as ComponentType<PageComponentProps>)),
    "richText": dynamic(() => import("@/modules/builder/components/standard/rich-text/rich-text").then(mod => mod.RichText as ComponentType<PageComponentProps>)),
    "tabs": dynamic(() => import("@/modules/builder/components/standard/tabs-block/tabs-block").then(mod => mod.TabsBlock as ComponentType<PageComponentProps>)),

    // Layout
    "section": dynamic(() => import("@/modules/builder/components/layout/section/section").then(mod => mod.SectionNode as ComponentType<PageComponentProps>)),

    // SmartCity
    "dashboardGrid": dynamic(() => import("@/modules/integrations/smartcity/components/dashboard-grid/dashboard-grid").then(mod => mod.DashboardGrid as ComponentType<PageComponentProps>)),
    "kpiGrid": dynamic(() => import("@/modules/integrations/smartcity/components/kpi-grid/kpi-grid").then(mod => mod.KpiGrid as ComponentType<PageComponentProps>)),
    "metricChart": dynamic(() => import("@/modules/integrations/smartcity/components/metric-chart/metric-chart").then(mod => mod.MetricChart as ComponentType<PageComponentProps>)),
    "metricComparisonChart": dynamic(() => import("@/modules/integrations/smartcity/components/metric-comparison-chart/metric-comparison-chart").then(mod => mod.MetricComparisonChart as ComponentType<PageComponentProps>)),
    "metricDonut": dynamic(() => import("@/modules/integrations/smartcity/components/metric-donut/metric-donut").then(mod => mod.MetricDonut as ComponentType<PageComponentProps>)),
    "metricGauge": dynamic(() => import("@/modules/integrations/smartcity/components/metric-gauge/metric-gauge").then(mod => mod.MetricGauge as ComponentType<PageComponentProps>)),
    "metricTable": dynamic(() => import("@/modules/integrations/smartcity/components/metric-table/metric-table").then(mod => mod.MetricTable as ComponentType<PageComponentProps>)),
    "metricTrendChart": dynamic(() => import("@/modules/integrations/smartcity/components/metric-trend-chart/metric-trend-chart").then(mod => mod.MetricTrendChart as ComponentType<PageComponentProps>)),
};
