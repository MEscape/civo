import { isPlainObject, truncate, hasUnsafePathSegment } from '@lib/utils';

import { isValidSourcePath } from '../mapping/dataset-mapping';
import { toRecordList } from '../mapping/mapped-record';

export type DiscoveredSampleKind = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';

export interface DiscoveredField {
  readonly path: string;
  readonly sampleType: DiscoveredSampleKind;
  /** A short preview, truncated: never the full value of a large field. */
  readonly sampleValue: string;
}

export interface DataDiscovery {
  readonly fields: readonly DiscoveredField[];
  /** The raw records the fields were inferred from; empty when the source returned none. */
  readonly sample: readonly unknown[];
}

export const DISCOVERY_LIMITS = {
  sampleSize: 5,
  maxDepth: 4,
  maxFields: 200,
  maxPreviewLength: 80,
} as const;

interface FlattenContext {
  readonly depth: number;
  readonly out: DiscoveredField[];
}

/** The first few records of a body: see `toRecordList` for what counts as one. */
export function toSampleRecords(body: unknown): unknown[] {
  return toRecordList(body).slice(0, DISCOVERY_LIMITS.sampleSize);
}

function isAddressableKey(key: string): boolean {
  return key !== '' && !/[.[\]]/.test(key) && !hasUnsafePathSegment(key);
}

function offer(out: DiscoveredField[], field: DiscoveredField): void {
  if (isValidSourcePath(field.path)) {
    out.push(field);
  }
}

function sampleKind(value: unknown): DiscoveredSampleKind {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  return 'string';
}

/**
 * Formats primitive values without implicitly stringifying arbitrary objects.
 */
function primitivePreview(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'symbol') {
    return value.description ?? 'Symbol()';
  }
  if (typeof value === 'undefined') {
    return 'undefined';
  }
  return '[function]';
}

function offerPrimitive(value: unknown, prefix: string, out: DiscoveredField[]): void {
  if (prefix === '') {
    return;
  }

  offer(out, {
    path: prefix,
    sampleType: sampleKind(value),
    sampleValue: truncate(primitivePreview(value), DISCOVERY_LIMITS.maxPreviewLength),
  });
}

function offerArray(value: unknown[], prefix: string, out: DiscoveredField[]): void {
  if (prefix === '') {
    return;
  }

  offer(out, {
    path: prefix,
    sampleType: 'array',
    sampleValue: `[${value.length} item(s)]`,
  });
}

function flattenObject(
  value: Record<string, unknown>,
  prefix: string,
  context: FlattenContext,
): void {
  if (context.depth >= DISCOVERY_LIMITS.maxDepth) {
    if (prefix !== '') {
      offer(context.out, {
        path: prefix,
        sampleType: 'object',
        sampleValue: '{…}',
      });
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (context.out.length >= DISCOVERY_LIMITS.maxFields) {
      break;
    }
    if (!isAddressableKey(key)) {
      continue;
    }

    flatten(nested, prefix ? `${prefix}.${key}` : key, {
      depth: context.depth + 1,
      out: context.out,
    });
  }
}

/**
 * Flattens one record into dot-path fields. Nested arrays remain single fields
 * because index-based paths would misleadingly address only one array element.
 */
function flatten(value: unknown, prefix: string, context: FlattenContext): void {
  if (context.out.length >= DISCOVERY_LIMITS.maxFields) {
    return;
  }

  if (value === null) {
    if (prefix !== '') {
      offer(context.out, {
        path: prefix,
        sampleType: 'null',
        sampleValue: 'null',
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    offerArray(value, prefix, context.out);
    return;
  }

  if (isPlainObject(value)) {
    flattenObject(value, prefix, context);
    return;
  }

  offerPrimitive(value, prefix, context.out);
}

/**
 * The union of fields across sampled records. Each path retains the first
 * sample value encountered.
 */
export function discoverFromBody(body: unknown): DataDiscovery {
  const sample = toSampleRecords(body);
  const byPath = new Map<string, DiscoveredField>();

  for (const record of sample) {
    const fields: DiscoveredField[] = [];

    flatten(record, '', { depth: 0, out: fields });

    for (const field of fields) {
      if (byPath.size >= DISCOVERY_LIMITS.maxFields) {
        return { fields: [...byPath.values()], sample };
      }

      if (!byPath.has(field.path)) {
        byPath.set(field.path, field);
      }
    }
  }

  return { fields: [...byPath.values()], sample };
}
