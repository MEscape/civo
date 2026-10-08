import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { assertNever, getPath, isBlank, isValidUrl, setPath, normalizePath } from '@lib/utils';

import { DATA_SOURCE_VALIDATION_CODES, mappingFailed } from '../errors/data-source-errors';

import type { DatasetMapping, TransformDefinition } from './dataset-mapping';
import type { DataSourceValidationCode } from '../errors/data-source-errors';

const CODES = DATA_SOURCE_VALIDATION_CODES;

type TransformOutcome =
  | { readonly isValid: true; readonly value: unknown }
  | { readonly isValid: false; readonly code: DataSourceValidationCode };

const VALID_BLANK: TransformOutcome = { isValid: true, value: undefined };
const HTTP_PROTOCOLS = ['http:', 'https:'] as const;

function valid(value: unknown): TransformOutcome {
  return { isValid: true, value };
}

function invalid(code: DataSourceValidationCode): TransformOutcome {
  return { isValid: false, code };
}

/** Missing, null, empty and whitespace-only values all count as "no value". */
function isBlankValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && isBlank(value));
}

function sourceValue(record: unknown, path: string): unknown {
  return getPath(record, normalizePath(path));
}

function toDate(raw: unknown): Date | null {
  if (!(typeof raw === 'string' || typeof raw === 'number' || raw instanceof Date)) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function applyString(raw: unknown): TransformOutcome {
  if (raw === undefined || raw === null) {
    return VALID_BLANK;
  }

  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return valid(String(raw));
  }

  return invalid(CODES.valueNotText);
}

function applyNumber(raw: unknown): TransformOutcome {
  if (isBlankValue(raw)) {
    return VALID_BLANK;
  }

  const parsed = typeof raw === 'string' ? Number(raw.trim()) : raw;

  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? valid(parsed)
    : invalid(CODES.valueNotNumber);
}

function applyBoolean(raw: unknown): TransformOutcome {
  if (raw === undefined || raw === null) {
    return VALID_BLANK;
  }
  if (typeof raw === 'boolean') {
    return valid(raw);
  }
  if (raw === 'true') {
    return valid(true);
  }
  if (raw === 'false') {
    return valid(false);
  }

  return invalid(CODES.valueNotBoolean);
}

function applyDate(raw: unknown): TransformOutcome {
  if (isBlankValue(raw)) {
    return VALID_BLANK;
  }

  const date = toDate(raw);
  return date ? valid(date) : invalid(CODES.valueNotDate);
}

function applyUrl(raw: unknown): TransformOutcome {
  if (isBlankValue(raw)) {
    return VALID_BLANK;
  }

  if (typeof raw !== 'string' || !isValidUrl(raw, HTTP_PROTOCOLS)) {
    return invalid(CODES.valueNotUrl);
  }

  return valid(new URL(raw).toString());
}

function applyJoin(
  transform: Extract<TransformDefinition, { kind: 'join' }>,
  record: unknown,
): TransformOutcome {
  const parts = transform.sourcePaths
    .map((path) => sourceValue(record, path))
    .filter((value) => !isBlankValue(value))
    .map(String);

  return valid(parts.length > 0 ? parts.join(transform.separator) : undefined);
}

function applyFallback(
  transform: Extract<TransformDefinition, { kind: 'fallback' }>,
  raw: unknown,
): TransformOutcome {
  return valid(isBlankValue(raw) ? transform.value : raw);
}

/**
 * Applies one fixed transform. Expected failures are values, not
 * exceptions: a bad record is a normal outcome of external data.
 */
function applyTransform(
  transform: TransformDefinition | undefined,
  raw: unknown,
  record: unknown,
): TransformOutcome {
  if (transform === undefined) {
    return valid(raw);
  }

  switch (transform.kind) {
    case 'string':
      return applyString(raw);
    case 'number':
      return applyNumber(raw);
    case 'boolean':
      return applyBoolean(raw);
    case 'date':
    case 'datetime':
      return applyDate(raw);
    case 'url':
      return applyUrl(raw);
    case 'join':
      return applyJoin(transform, record);
    case 'fallback':
      return applyFallback(transform, raw);
    default:
      return assertNever(transform);
  }
}

/**
 * Applies a mapping to one external record. Every field problem is
 * collected (keyed by target path) instead of stopping at the first, so an
 * administrator sees the whole picture at once.
 *
 * The result is UNVALIDATED canonical data: the consumer validates it
 * against its own canonical schema before use.
 */
export function applyMapping(
  mapping: DatasetMapping,
  record: unknown,
): AppResult<Record<string, unknown>, ValidationAppError> {
  let output: Record<string, unknown> = {};
  const fieldErrors: Record<string, string[]> = {};

  const fail = (targetPath: string, code: DataSourceValidationCode) => {
    (fieldErrors[targetPath] ??= []).push(code);
  };

  for (const field of mapping.fields) {
    // A join reads its own sources, so the field's own source path is not consulted.
    const raw =
      field.transform?.kind === 'join' ? undefined : sourceValue(record, field.sourcePath);
    const outcome = applyTransform(field.transform, raw, record);

    if (!outcome.isValid) {
      fail(field.targetPath, outcome.code);
    } else if (field.required && isBlankValue(outcome.value)) {
      fail(field.targetPath, CODES.valueMissing);
    } else if (outcome.value !== undefined) {
      // Target paths were validated when the mapping was created; `setPath` also refuses prototype segments.
      output = setPath(output, field.targetPath, outcome.value);
    }
  }

  return Object.keys(fieldErrors).length > 0 ? err(mappingFailed(fieldErrors)) : ok(output);
}
