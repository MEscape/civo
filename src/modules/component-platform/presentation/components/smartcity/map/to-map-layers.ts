import type { Attributes, MapFeatureInput, MapLayerInput } from '@modules/map';

import type { ContentOf } from '../../../../application/contracts/component-platform-constraints';

type GeoFeatureRecord = ContentOf<'GeoFeature'>;

/** Attributes the record defines itself win over a municipality's free-form property of the same name. */
function definedOnly(values: Record<string, string | number | boolean | undefined>): Attributes {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string | number | boolean] => entry[1] !== undefined,
    ),
  );
}

export function geoFeatureToMapFeature(record: GeoFeatureRecord): MapFeatureInput {
  return {
    id: record.id,
    label: record.name,
    ...(record.geometry === undefined ? {} : { geometry: record.geometry }),
    latitude: record.latitude,
    longitude: record.longitude,
    description: record.description,
    href: record.href,
    attributes: {
      ...record.properties,
      ...definedOnly({
        category: record.category,
        status: record.status,
        value: record.value,
        unit: record.unit,
        observedAt: record.observedAt,
      }),
    },
  };
}

export function toLayer(
  id: string,
  label: string,
  features: readonly MapFeatureInput[],
): MapLayerInput {
  return { id, label, features };
}
