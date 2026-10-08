import { AlertBanner } from '../civic/alert-banner/alert-banner';
import { AlertBannerSkeleton } from '../civic/alert-banner/alert-banner.skeleton';
import { ContactCard } from '../civic/contact-card/contact-card';
import { ContactCardSkeleton } from '../civic/contact-card/contact-card.skeleton';
import { CouncilBlock } from '../civic/council-block/council-block';
import { CouncilBlockSkeleton } from '../civic/council-block/council-block.skeleton';
import { DepartmentDirectory } from '../civic/department-directory/department-directory';
import { DepartmentDirectorySkeleton } from '../civic/department-directory/department-directory.skeleton';
import { EventsGrid } from '../civic/events-grid/events-grid';
import { EventsGridSkeleton } from '../civic/events-grid/events-grid.skeleton';
import { NewsAndEventsSplit } from '../civic/news-and-events-split/news-and-events-split';
import { NewsAndEventsSplitSkeleton } from '../civic/news-and-events-split/news-and-events-split.skeleton';
import { NewsGrid } from '../civic/news-grid/news-grid';
import { NewsGridSkeleton } from '../civic/news-grid/news-grid.skeleton';
import { OpeningHours } from '../civic/opening-hours/opening-hours';
import { OpeningHoursSkeleton } from '../civic/opening-hours/opening-hours.skeleton';
import { QuickLinks } from '../civic/quick-links/quick-links';
import { ServiceFinder } from '../civic/service-finder/service-finder';
import { ServiceFinderSkeleton } from '../civic/service-finder/service-finder.skeleton';
import { ServiceGrid } from '../civic/service-grid/service-grid';
import { ServiceGridSkeleton } from '../civic/service-grid/service-grid.skeleton';
import { WasteCalendar } from '../civic/waste-calendar/waste-calendar';
import { WasteCalendarSkeleton } from '../civic/waste-calendar/waste-calendar.skeleton';
import { AccordionBlock } from '../content/accordion-block';
import { CallToAction } from '../content/call-to-action';
import { CardGrid } from '../content/card-grid';
import { Hero } from '../content/hero';
import { RichText } from '../content/rich-text';
import { TabsBlock } from '../content/tabs-block';
import { SectionBlock } from '../layout/section-block';
import { MetricComparisonChart } from '../smartcity/comparison-chart/metric-comparison-chart';
import { MetricComparisonChartSkeleton } from '../smartcity/comparison-chart/metric-comparison-chart.skeleton';
import { DashboardGrid } from '../smartcity/dashboard-grid/dashboard-grid';
import { DashboardGridSkeleton } from '../smartcity/dashboard-grid/dashboard-grid.skeleton';
import { MetricDonutChart } from '../smartcity/donut-chart/metric-donut-chart';
import { MetricDonutChartSkeleton } from '../smartcity/donut-chart/metric-donut-chart.skeleton';
import { MetricGaugeChart } from '../smartcity/gauge-chart/metric-gauge-chart';
import { MetricGaugeChartSkeleton } from '../smartcity/gauge-chart/metric-gauge-chart.skeleton';
import { KpiGrid } from '../smartcity/kpi-grid/kpi-grid';
import { KpiGridSkeleton } from '../smartcity/kpi-grid/kpi-grid.skeleton';
import { MapBlock } from '../smartcity/map/map-block';
import { MapBlockSkeleton } from '../smartcity/map/map-block.skeleton';
import { MetricChart } from '../smartcity/metric-chart/metric-chart';
import { MetricChartSkeleton } from '../smartcity/metric-chart/metric-chart.skeleton';
import { MetricTable } from '../smartcity/metric-table/metric-table';
import { MetricTableSkeleton } from '../smartcity/metric-table/metric-table.skeleton';
import { MetricTrendChart } from '../smartcity/trend-chart/metric-trend-chart';
import { MetricTrendChartSkeleton } from '../smartcity/trend-chart/metric-trend-chart.skeleton';

import { implementComponent } from './component-implementation';

import type { ComponentImplementation } from './component-implementation';
import type { RegisteredComponentName } from '../../../application/contracts/component-platform-constraints';

/**
 * One implementation per registered component, and the compiler holds the
 * two lists together: a definition without an entry here, or an entry for a
 * type that is not registered, does not compile.
 *
 * Data components stream behind a skeleton on published pages; components
 * that render synchronously have none.
 */
export const COMPONENT_IMPLEMENTATIONS = {
  // layout
  section: implementComponent('section', {
    render: ({ props, children }) => <SectionBlock tone={props.tone}>{children}</SectionBlock>,
  }),

  // content
  accordion: implementComponent('accordion', {
    render: ({ props }) => <AccordionBlock props={props} />,
  }),
  callToAction: implementComponent('callToAction', {
    render: ({ props }) => <CallToAction props={props} />,
  }),
  cardGrid: implementComponent('cardGrid', {
    render: ({ props }) => <CardGrid props={props} />,
  }),
  hero: implementComponent('hero', {
    render: ({ props }) => <Hero props={props} />,
  }),
  richText: implementComponent('richText', {
    render: ({ props }) => <RichText props={props} />,
  }),
  tabs: implementComponent('tabs', {
    render: ({ props }) => <TabsBlock props={props} />,
  }),

  // civic
  alertBanner: implementComponent('alertBanner', {
    render: ({ props, context, loadContent }) => (
      <AlertBanner props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <AlertBannerSkeleton />,
  }),
  contactCard: implementComponent('contactCard', {
    render: ({ props, context, loadContent }) => (
      <ContactCard props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <ContactCardSkeleton />,
  }),
  councilBlock: implementComponent('councilBlock', {
    render: ({ props, context, loadContent }) => (
      <CouncilBlock props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <CouncilBlockSkeleton />,
  }),
  departmentDirectory: implementComponent('departmentDirectory', {
    render: ({ props, context, loadContent }) => (
      <DepartmentDirectory props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <DepartmentDirectorySkeleton />,
  }),
  eventsGrid: implementComponent('eventsGrid', {
    render: ({ props, context, loadContent }) => (
      <EventsGrid props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <EventsGridSkeleton />,
  }),
  newsAndEventsSplit: implementComponent('newsAndEventsSplit', {
    render: ({ props, context, loadContent }) => (
      <NewsAndEventsSplit props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <NewsAndEventsSplitSkeleton />,
  }),
  newsGrid: implementComponent('newsGrid', {
    render: ({ props, context, loadContent }) => (
      <NewsGrid props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <NewsGridSkeleton />,
  }),
  openingHours: implementComponent('openingHours', {
    render: ({ props, context, loadContent }) => (
      <OpeningHours props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <OpeningHoursSkeleton />,
  }),
  quickLinks: implementComponent('quickLinks', {
    render: ({ props }) => <QuickLinks props={props} />,
  }),
  serviceFinder: implementComponent('serviceFinder', {
    render: ({ props, context, loadContent }) => (
      <ServiceFinder props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <ServiceFinderSkeleton />,
  }),
  serviceGrid: implementComponent('serviceGrid', {
    render: ({ props, context, loadContent }) => (
      <ServiceGrid props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <ServiceGridSkeleton />,
  }),
  wasteCalendar: implementComponent('wasteCalendar', {
    render: ({ props, context, loadContent }) => (
      <WasteCalendar props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <WasteCalendarSkeleton />,
  }),

  // smartcity
  dashboardGrid: implementComponent('dashboardGrid', {
    render: ({ props, context, loadContent }) => (
      <DashboardGrid props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <DashboardGridSkeleton />,
  }),
  kpiGrid: implementComponent('kpiGrid', {
    render: ({ props, context, loadContent }) => (
      <KpiGrid props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <KpiGridSkeleton />,
  }),
  map: implementComponent('map', {
    render: ({ props, context, loadContent, mapSection }) => (
      <MapBlock props={props} context={context} loadContent={loadContent} mapSection={mapSection} />
    ),
    skeleton: <MapBlockSkeleton />,
  }),
  metricChart: implementComponent('metricChart', {
    render: ({ props, context, loadContent }) => (
      <MetricChart props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricChartSkeleton />,
  }),
  metricComparisonChart: implementComponent('metricComparisonChart', {
    render: ({ props, context, loadContent }) => (
      <MetricComparisonChart props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricComparisonChartSkeleton />,
  }),
  metricDonut: implementComponent('metricDonut', {
    render: ({ props, context, loadContent }) => (
      <MetricDonutChart props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricDonutChartSkeleton />,
  }),
  metricGauge: implementComponent('metricGauge', {
    render: ({ props, context, loadContent }) => (
      <MetricGaugeChart props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricGaugeChartSkeleton />,
  }),
  metricTable: implementComponent('metricTable', {
    render: ({ props, context, loadContent }) => (
      <MetricTable props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricTableSkeleton />,
  }),
  metricTrendChart: implementComponent('metricTrendChart', {
    render: ({ props, context, loadContent }) => (
      <MetricTrendChart props={props} context={context} loadContent={loadContent} />
    ),
    skeleton: <MetricTrendChartSkeleton />,
  }),
} as const satisfies Record<RegisteredComponentName, ComponentImplementation>;

const IMPLEMENTATIONS_BY_TYPE: ReadonlyMap<string, ComponentImplementation> = new Map(
  Object.entries(COMPONENT_IMPLEMENTATIONS),
);

/**
 * Looks a type up by exact key. A `Map` rather than property access, so a
 * stored type such as "constructor" can never resolve to an inherited member.
 */
export function findImplementation(type: string): ComponentImplementation | undefined {
  return IMPLEMENTATIONS_BY_TYPE.get(type);
}
