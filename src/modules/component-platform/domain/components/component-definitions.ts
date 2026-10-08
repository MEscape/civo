import { invariant } from '@lib/utils';

import { alertBannerDefinition } from './civic/alert-banner.component';
import { contactCardDefinition } from './civic/contact-card.component';
import { councilBlockDefinition } from './civic/council-block.component';
import { departmentDirectoryDefinition } from './civic/department-directory.component';
import { eventsGridDefinition } from './civic/events-grid.component';
import { newsAndEventsSplitDefinition } from './civic/news-and-events-split.component';
import { newsGridDefinition } from './civic/news-grid.component';
import { openingHoursDefinition } from './civic/opening-hours.component';
import { quickLinksDefinition } from './civic/quick-links.component';
import { serviceFinderDefinition } from './civic/service-finder.component';
import { serviceGridDefinition } from './civic/service-grid.component';
import { wasteCalendarDefinition } from './civic/waste-calendar.component';
import { accordionDefinition } from './content/accordion.component';
import { callToActionDefinition } from './content/call-to-action.component';
import { cardGridDefinition } from './content/card-grid.component';
import { heroDefinition } from './content/hero.component';
import { richTextDefinition } from './content/rich-text.component';
import { tabsDefinition } from './content/tabs.component';
import { sectionDefinition } from './layout/section.component';
import { dashboardGridDefinition } from './smartcity/dashboard-grid.component';
import { kpiGridDefinition } from './smartcity/kpi-grid.component';
import { mapDefinition } from './smartcity/map.component';
import { metricChartDefinition } from './smartcity/metric-chart.component';
import { metricComparisonChartDefinition } from './smartcity/metric-comparison-chart.component';
import { metricDonutDefinition } from './smartcity/metric-donut.component';
import { metricGaugeDefinition } from './smartcity/metric-gauge.component';
import { metricTableDefinition } from './smartcity/metric-table.component';
import { metricTrendChartDefinition } from './smartcity/metric-trend-chart.component';

import type { ComponentDefinition } from '../models/component-definition';

/**
 * Every component the platform knows. The tuple is `as const` so its
 * `type` literals feed `RegisteredComponentName`, which the renderer's
 * implementation table must cover completely.
 */
export const COMPONENT_DEFINITIONS = [
  sectionDefinition,
  accordionDefinition,
  callToActionDefinition,
  cardGridDefinition,
  heroDefinition,
  richTextDefinition,
  tabsDefinition,
  alertBannerDefinition,
  contactCardDefinition,
  councilBlockDefinition,
  departmentDirectoryDefinition,
  eventsGridDefinition,
  newsAndEventsSplitDefinition,
  newsGridDefinition,
  openingHoursDefinition,
  quickLinksDefinition,
  serviceFinderDefinition,
  serviceGridDefinition,
  wasteCalendarDefinition,
  dashboardGridDefinition,
  kpiGridDefinition,
  mapDefinition,
  metricChartDefinition,
  metricComparisonChartDefinition,
  metricDonutDefinition,
  metricGaugeDefinition,
  metricTableDefinition,
  metricTrendChartDefinition,
] as const;

type RegisteredDefinition = (typeof COMPONENT_DEFINITIONS)[number];

export type RegisteredComponentName = RegisteredDefinition['type'];

/** The parsed props of one registered component, derived from its definition. */
export type ComponentProps<T extends RegisteredComponentName> = ReturnType<
  Extract<RegisteredDefinition, { readonly type: T }>['parseProps']
>;

/**
 * The definition of one registered component, typed by its props. The table
 * is a tuple, so TypeScript cannot relate a generic name to the matching
 * entry; this is the one place that says so.
 */
export function getComponentDefinition<T extends RegisteredComponentName>(
  type: T,
): ComponentDefinition<ComponentProps<T>> {
  const definition = COMPONENT_DEFINITIONS.find((candidate) => candidate.type === type);
  invariant(definition !== undefined, `Component "${type}" is not registered.`);

  return definition as unknown as ComponentDefinition<ComponentProps<T>>;
}
