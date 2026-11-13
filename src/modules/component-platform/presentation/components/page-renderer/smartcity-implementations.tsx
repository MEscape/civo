import { MetricComparisonChart } from '../smartcity/comparison-chart/metric-comparison-chart';
import { DashboardGrid } from '../smartcity/dashboard-grid/dashboard-grid';
import { MetricDonutChart } from '../smartcity/donut-chart/metric-donut-chart';
import { MetricGaugeChart } from '../smartcity/gauge-chart/metric-gauge-chart';
import { KpiGrid } from '../smartcity/kpi-grid/kpi-grid';
import { MapBlock } from '../smartcity/map/map-block';
import { MetricChart } from '../smartcity/metric-chart/metric-chart';
import { MetricTable } from '../smartcity/metric-table/metric-table';
import { StatusBoard } from '../smartcity/status-board/status-board';
import { MetricTrendChart } from '../smartcity/trend-chart/metric-trend-chart';

import { implementComponent } from './component-implementation';

import type { ComponentImplementation } from './component-implementation';
import type { RegisteredComponentName } from '../../../application/contracts/component-platform-constraints';

/** The smart-city components: datasets drawn as tiles, charts, tables and maps. */
export const SMART_CITY_IMPLEMENTATIONS = {
  statusBoard: implementComponent('statusBoard', {
    render: ({ props, context, loadContent }) => (
      <StatusBoard props={props} context={context} loadContent={loadContent} />
    ),
  }),
  dashboardGrid: implementComponent('dashboardGrid', {
    render: ({ props, context, loadContent }) => (
      <DashboardGrid props={props} context={context} loadContent={loadContent} />
    ),
  }),
  kpiGrid: implementComponent('kpiGrid', {
    render: ({ props, context, loadContent }) => (
      <KpiGrid props={props} context={context} loadContent={loadContent} />
    ),
  }),
  map: implementComponent('map', {
    render: ({ props, context, loadContent, mapSection }) => (
      <MapBlock props={props} context={context} loadContent={loadContent} mapSection={mapSection} />
    ),
  }),
  metricChart: implementComponent('metricChart', {
    render: ({ props, context, loadContent }) => (
      <MetricChart props={props} context={context} loadContent={loadContent} />
    ),
  }),
  metricComparisonChart: implementComponent('metricComparisonChart', {
    render: ({ props, context, loadContent }) => (
      <MetricComparisonChart props={props} context={context} loadContent={loadContent} />
    ),
  }),
  metricDonut: implementComponent('metricDonut', {
    render: ({ props, context, loadContent }) => (
      <MetricDonutChart props={props} context={context} loadContent={loadContent} />
    ),
  }),
  metricGauge: implementComponent('metricGauge', {
    render: ({ props, context, loadContent }) => (
      <MetricGaugeChart props={props} context={context} loadContent={loadContent} />
    ),
  }),
  metricTable: implementComponent('metricTable', {
    render: ({ props, context, loadContent }) => (
      <MetricTable props={props} context={context} loadContent={loadContent} />
    ),
  }),
  metricTrendChart: implementComponent('metricTrendChart', {
    render: ({ props, context, loadContent }) => (
      <MetricTrendChart props={props} context={context} loadContent={loadContent} />
    ),
  }),
} as const satisfies Partial<Record<RegisteredComponentName, ComponentImplementation>>;
