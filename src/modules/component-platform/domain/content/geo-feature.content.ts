import {
  instant,
  number,
  opaqueRecord,
  optional,
  scalarMap,
  withFallback,
} from '../models/field-schema';

import { CONTENT_LIMITS as LIMITS } from './content-limits';
import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { label, optionalLinkTarget, recordId, shortText, title } from './shared-fields';

/**
 * One located thing on a map: a point, a line or an area. The contract is
 * deliberately generic. `category`, `status`, `value` and `observedAt` are
 * the dimensions a map can colour, size, filter and date by; everything a
 * municipality adds on top travels in `properties`.
 *
 * `geometry` is opaque here: the map owns GeoJSON validation and drops a
 * feature whose geometry is unusable. A geometry that is not even an object
 * degrades to "absent", so a feature with valid `latitude`/`longitude`
 * still shows.
 */
/** Sample positions are written as named longitude/latitude pairs; GeoJSON wants `[lng, lat]`. */
function positions(
  points: ReadonlyArray<{ readonly lng: number; readonly lat: number }>,
): Array<[number, number]> {
  return points.map(({ lng, lat }) => [lng, lat]);
}

export const geoFeatureContent = defineContent({
  shape: {
    id: recordId(),
    name: title(),
    geometry: withFallback(optional(opaqueRecord({ maxNodes: LIMITS.geometryNodes })), undefined),
    latitude: optional(number({ min: -90, max: 90 })),
    longitude: optional(number({ min: -180, max: 180 })),
    category: label(),
    status: label(),
    value: optional(number()),
    unit: label(),
    observedAt: optional(instant()),
    description: shortText(),
    href: optionalLinkTarget(),
    properties: withFallback(
      optional(
        scalarMap({
          maxEntries: LIMITS.propertyEntries,
          maxKeyLength: LIMITS.propertyKey,
          maxTextLength: LIMITS.label,
        }),
      ),
      undefined,
    ),
  },
  rule: {
    categoryOf: (feature) => feature.category,
  },
}).withSample((now) => [
  {
    id: 'sample-geo-1',
    name: 'Ladestation Marktplatz',
    latitude: 51.0,
    longitude: 10.0,
    category: 'Ladestation',
    status: 'frei',
    value: 4,
    unit: 'Ladepunkte',
    observedAt: sampleInstant(now, { days: 0, hour: 6 }),
  },
  {
    id: 'sample-geo-2',
    name: 'Ladestation Bahnhof',
    latitude: 51.004,
    longitude: 10.012,
    category: 'Ladestation',
    status: 'belegt',
    value: 2,
    unit: 'Ladepunkte',
    observedAt: sampleInstant(now, { days: 0, hour: 6 }),
  },
  {
    id: 'sample-geo-3',
    name: 'Ladestation Rathaus',
    latitude: 50.997,
    longitude: 9.99,
    category: 'Ladestation',
    status: 'gestört',
    value: 6,
    unit: 'Ladepunkte',
    observedAt: sampleInstant(now, { days: -1, hour: 6 }),
  },
  {
    id: 'sample-geo-4',
    name: 'Radweg Flusstal',
    category: 'Radweg',
    geometry: {
      type: 'LineString',
      coordinates: positions([
        { lng: 9.98, lat: 50.99 },
        { lng: 9.995, lat: 51.002 },
        { lng: 10.01, lat: 51.006 },
      ]),
    },
  },
  {
    id: 'sample-geo-5',
    name: 'Innenstadt',
    category: 'Stadtbezirk',
    geometry: {
      type: 'Polygon',
      coordinates: [
        positions([
          { lng: 9.985, lat: 50.994 },
          { lng: 10.008, lat: 50.994 },
          { lng: 10.008, lat: 51.008 },
          { lng: 9.985, lat: 51.008 },
          { lng: 9.985, lat: 50.994 },
        ]),
      ],
    },
  },
]);
