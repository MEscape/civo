/**
 * Upper bounds for every externally supplied string and list. Records come
 * from third-party APIs, so each field is capped before it can reach a page.
 */
export const CONTENT_LIMITS = {
  id: 128,
  title: 300,
  label: 200,
  shortText: 500,
  longText: 20_000,
  url: 2_048,
  phone: 64,
  keywords: 20,
  members: 100,
  contacts: 50,
  seriesPoints: 500,
  breakdownEntries: 50,
  /** Nested values of one GeoJSON geometry. */
  geometryNodes: 20_000,
  propertyEntries: 40,
  propertyKey: 64,
} as const;
