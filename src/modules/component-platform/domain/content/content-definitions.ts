import { alertContent } from './alert.content';
import { contactContent } from './contact.content';
import { councilBodyContent } from './council-body.content';
import { departmentContent } from './department.content';
import { eventContent } from './event.content';
import { geoFeatureContent } from './geo-feature.content';
import { newsItemContent } from './news-item.content';
import { openingHoursEntryContent } from './opening-hours-entry.content';
import { serviceDetailContent } from './service-detail.content';
import { serviceContent } from './service.content';
import { smartCityBreakdownEntryContent } from './smart-city-breakdown-entry.content';
import { smartCityGoalContent } from './smart-city-goal.content';
import { smartCityMetricContent } from './smart-city-metric.content';
import { smartCityObservationContent } from './smart-city-observation.content';
import { wasteCollectionEntryContent } from './waste-collection-entry.content';

import type { ContentDefinition } from '../models/content-definition';

/**
 * The single registry of canonical contracts, keyed by kind. The key IS the
 * kind: `ContentKind`, `ContentOf` and every lookup derive from this table,
 * so a kind exists exactly when it has a contract here, and adding one is
 * one file plus one line.
 *
 * The data-sources module owns the list of kinds a dataset can provide;
 * this table is the subset the platform can render. `composition.ts` proves
 * at compile time that every kind here exists there, and nothing forces the
 * reverse: a kind added to data-sources needs no change in this module until
 * a component renders it.
 */
export const CONTENT_DEFINITIONS = {
  Event: eventContent,
  NewsItem: newsItemContent,
  Service: serviceContent,
  Contact: contactContent,
  OpeningHoursEntry: openingHoursEntryContent,
  ServiceDetail: serviceDetailContent,
  CouncilBody: councilBodyContent,
  WasteCollectionEntry: wasteCollectionEntryContent,
  Alert: alertContent,
  Department: departmentContent,
  SmartCityMetric: smartCityMetricContent,
  SmartCityGoal: smartCityGoalContent,
  SmartCityObservation: smartCityObservationContent,
  SmartCityBreakdownEntry: smartCityBreakdownEntryContent,
  GeoFeature: geoFeatureContent,
} as const;

export type ContentKind = keyof typeof CONTENT_DEFINITIONS;

/** The record shape one kind validates to. */
export type ContentOf<K extends ContentKind> =
  (typeof CONTENT_DEFINITIONS)[K] extends ContentDefinition<infer R> ? R : never;

/** Narrows untrusted text (a stored component dependency, a request value) to a known kind. */
export function isContentKind(value: string): value is ContentKind {
  return Object.hasOwn(CONTENT_DEFINITIONS, value);
}

export const CONTENT_KINDS: readonly ContentKind[] =
  Object.keys(CONTENT_DEFINITIONS).filter(isContentKind);

/**
 * The definition of one kind, typed by its record shape. The table is keyed
 * by kind, so the lookup is exact, but TypeScript cannot relate the
 * generic key to the per-key record type; this is the one place that says so.
 */
export function getContentDefinition<K extends ContentKind>(
  kind: K,
): ContentDefinition<ContentOf<K>> {
  return CONTENT_DEFINITIONS[kind] as unknown as ContentDefinition<ContentOf<K>>;
}
