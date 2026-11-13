import { isPlainObject, stripHtml } from '@lib/utils';

import { MAP_FEATURE_LIMITS as LIMITS } from '../../domain/features/map-features';

import type {
  Attributes,
  AttributeValue,
  MapFeatureInput,
} from '../../domain/features/map-features';

const CANONICAL_ATTRIBUTES = ['category', 'status', 'value', 'unit', 'observedAt'] as const;

function scalar(value: unknown): value is AttributeValue {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.length <= LIMITS.propertyText) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** Stop on the first over-budget property; never spread or enumerate an unbounded property bag. */
function propertiesOf(value: unknown): Record<string, AttributeValue> | null {
  if (value === undefined) {
    return {};
  }
  if (!isPlainObject(value)) {
    return null;
  }
  const result: Record<string, AttributeValue> = {};
  let count = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) {
      continue;
    }
    const entry = value[key];
    if (++count > LIMITS.properties || key.length > LIMITS.propertyKey || !scalar(entry)) {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

function attributesOf(value: Record<string, unknown>): Attributes | null {
  const result = propertiesOf(value['properties']);
  if (result === null) {
    return null;
  }
  for (const key of CANONICAL_ATTRIBUTES) {
    const raw = value[key];
    // Mapping transforms may produce Date instants, just as in DatasetContentSource.
    const entry: unknown =
      raw instanceof Date && Number.isFinite(raw.getTime()) ? raw.toISOString() : raw;
    if (entry === undefined) {
      continue;
    }
    if (!scalar(entry)) {
      return null;
    }
    result[key] = entry;
  }
  return result;
}

function optionalText(value: unknown, max: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function readTexts(
  value: Readonly<Record<string, unknown>>,
): { name: string; description: string | undefined; href: string | undefined } | null {
  const { name, description, href } = value;
  if (
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > LIMITS.label ||
    !optionalText(description, LIMITS.description) ||
    !optionalText(href, LIMITS.href)
  ) {
    return null;
  }
  return { name, description, href };
}

/** Primitive bounds precede profiling and serialization; geometry stays untrusted until the domain validates it. */
export function normalizeMapRecord(record: {
  readonly id: string;
  readonly values: unknown;
}): MapFeatureInput | null {
  if (!isPlainObject(record.values) || record.id.length === 0 || record.id.length > LIMITS.id) {
    return null;
  }
  const value = record.values;
  const texts = readTexts(value);
  const attributes = attributesOf(value);
  if (texts === null || attributes === null) {
    return null;
  }
  return {
    id: record.id,
    label: texts.name,
    geometry: value['geometry'],
    latitude: numberOrUndefined(value['latitude']),
    longitude: numberOrUndefined(value['longitude']),
    description: texts.description === undefined ? undefined : stripHtml(texts.description),
    href: texts.href,
    attributes,
  };
}
