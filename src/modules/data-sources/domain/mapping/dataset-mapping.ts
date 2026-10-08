import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { fieldPath } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import {
  assertNever,
  hasUnsafePathSegment,
  isPlainObject,
  literalGuard,
  pathSegments,
} from '@lib/utils';

import {
  DATA_SOURCE_VALIDATION_CODES,
  createDataSourceErrorBag,
} from '../errors/data-source-errors';

import { CANONICAL_TARGET_FIELDS } from './canonical-target-fields';

import type { CanonicalTargetField } from './canonical-target-fields';
import type { CanonicalKind } from '../models/canonical-kinds';

const CODES = DATA_SOURCE_VALIDATION_CODES;

/**
 * An explicit, serializable field mapping from an external record's shape
 * to canonical content fields. Deliberately NOT a programming language:
 * paths are resolved by `getPath`/`setPath` and the transforms below are a
 * fixed vocabulary. Nothing is ever evaluated.
 */
export const MAPPING_LIMITS = {
  maxFields: 50,
  maxPathLength: 200,
  maxTargetDepth: 5,
  maxJoinSources: 6,
  maxSeparatorLength: 20,
} as const;

export const DEFAULT_JOIN_SEPARATOR = ', ';

export const SIMPLE_TRANSFORM_KINDS = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'url',
] as const;
export type SimpleTransformKind = (typeof SIMPLE_TRANSFORM_KINDS)[number];

export const isSimpleTransformKind = literalGuard(SIMPLE_TRANSFORM_KINDS);

export type TransformDefinition =
  | { readonly kind: SimpleTransformKind }
  | {
      readonly kind: 'join';
      readonly sourcePaths: readonly string[];
      readonly separator: string;
    }
  | { readonly kind: 'fallback'; readonly value: string | number | boolean };

export interface FieldMapping {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly transform?: TransformDefinition;
  /** Derived from the canonical kind by the domain; a client cannot waive it. */
  readonly required: boolean;
}

export interface DatasetMapping {
  readonly fields: readonly FieldMapping[];
}

/** Untrusted-but-typed input; shape is checked at the boundary, invariants here. */
export type TransformInput =
  | { readonly kind: SimpleTransformKind }
  | {
      readonly kind: 'join';
      readonly sourcePaths: readonly string[];
      readonly separator?: string | undefined;
    }
  | { readonly kind: 'fallback'; readonly value: string | number | boolean };

export interface FieldMappingInput {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly transform?: TransformInput | undefined;
}

export interface DatasetMappingInput {
  readonly fields: readonly FieldMappingInput[];
}

/**
 * Target paths are WRITTEN to, so they are stricter than source paths:
 * plain dot-separated identifiers, bounded depth, no unsafe segments.
 */
const TARGET_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function isValidSourcePath(path: string): boolean {
  return (
    path.length > 0 && path.length <= MAPPING_LIMITS.maxPathLength && !hasUnsafePathSegment(path)
  );
}

function isValidTargetPathShape(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= MAPPING_LIMITS.maxPathLength &&
    TARGET_PATH_PATTERN.test(path) &&
    !hasUnsafePathSegment(path) &&
    path.split('.').length <= MAPPING_LIMITS.maxTargetDepth
  );
}

/** `location` and `location.name` conflict: writing one would clobber the other. */
function targetPathsConflict(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);
}

function normalizeJoin(
  transform: Extract<TransformInput, { kind: 'join' }>,
  path: string,
  bag: FieldErrorBag,
): TransformDefinition | undefined {
  const separator = transform.separator ?? DEFAULT_JOIN_SEPARATOR;
  const sources = transform.sourcePaths.map((source) => source.trim());

  if (
    sources.length < 1 ||
    sources.length > MAPPING_LIMITS.maxJoinSources ||
    !sources.every(isValidSourcePath) ||
    separator.length > MAPPING_LIMITS.maxSeparatorLength
  ) {
    bag.add(path, CODES.transformInvalid);
    return undefined;
  }

  return { kind: 'join', sourcePaths: sources, separator };
}

function normalizeFallback(
  transform: Extract<TransformInput, { kind: 'fallback' }>,
  path: string,
  bag: FieldErrorBag,
): TransformDefinition | undefined {
  if (typeof transform.value === 'number' && !Number.isFinite(transform.value)) {
    bag.add(path, CODES.transformInvalid);
    return undefined;
  }

  return { kind: 'fallback', value: transform.value };
}

function normalizeTransform(
  transform: TransformInput | undefined,
  path: string,
  bag: FieldErrorBag,
): TransformDefinition | undefined {
  if (transform === undefined) {
    return undefined;
  }

  switch (transform.kind) {
    case 'join':
      return normalizeJoin(transform, path, bag);

    case 'fallback':
      return normalizeFallback(transform, path, bag);

    case 'string':
    case 'number':
    case 'boolean':
    case 'url':
    case 'date':
    case 'datetime':
      return { kind: transform.kind };

    default:
      return assertNever(transform);
  }
}

function requiredFor(targets: readonly CanonicalTargetField[], targetPath: string): boolean {
  return targets.some((target) => target.path === targetPath && target.required);
}

/**
 * Builds a mapping for a canonical kind, enforcing every structural
 * invariant: bounded size, safe paths, targets drawn from the kind's own
 * fields, and no two targets clobbering each other. Partial mappings are
 * fine here (a preview needs one); see `ensureRequiredTargets` for save.
 */
export function createDatasetMapping(
  canonicalKind: CanonicalKind,
  input: DatasetMappingInput,
): AppResult<DatasetMapping, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  const targets = CANONICAL_TARGET_FIELDS[canonicalKind];
  const fields: FieldMapping[] = [];

  if (input.fields.length < 1 || input.fields.length > MAPPING_LIMITS.maxFields) {
    bag.add('fields', CODES.mappingFieldCountInvalid);
  }

  input.fields.forEach((field, index) => {
    const at = (property: string) => fieldPath('fields', index, property);
    const sourcePath = field.sourcePath.trim();
    const targetPath = field.targetPath.trim();

    if (!isValidSourcePath(sourcePath)) {
      bag.add(at('sourcePath'), CODES.sourcePathInvalid);
    }

    if (!isValidTargetPathShape(targetPath)) {
      bag.add(at('targetPath'), CODES.targetPathInvalid);
    } else if (!targets.some((target) => target.path === pathSegments(targetPath)[0])) {
      bag.add(at('targetPath'), CODES.targetPathUnknown);
    } else if (fields.some((earlier) => targetPathsConflict(earlier.targetPath, targetPath))) {
      bag.add(at('targetPath'), CODES.targetPathConflict);
    }

    const transform = normalizeTransform(field.transform, at('transform'), bag);
    fields.push({
      sourcePath,
      targetPath,
      ...(transform ? { transform } : {}),
      required: requiredFor(targets, targetPath),
    });
  });

  return bag.hasErrors ? err(bag.toError()) : ok({ fields });
}

/** A mapping can only be SAVED once every required canonical field is covered. */
export function ensureRequiredTargets(
  canonicalKind: CanonicalKind,
  mapping: DatasetMapping,
): AppResult<DatasetMapping, ValidationAppError> {
  const bag = createDataSourceErrorBag();
  for (const target of CANONICAL_TARGET_FIELDS[canonicalKind]) {
    const isCovered = mapping.fields.some((field) => field.targetPath === target.path);
    if (target.required && !isCovered) {
      bag.add(target.path, CODES.requiredTargetMissing);
    }
  }
  return bag.hasErrors ? err(bag.toError()) : ok(mapping);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function restoreTransform(stored: Record<string, unknown>): TransformInput | null {
  const kind = stored['kind'];
  if (typeof kind !== 'string') {
    return null;
  }
  if (isSimpleTransformKind(kind)) {
    return { kind };
  }

  if (kind === 'join' && isStringArray(stored['sourcePaths'])) {
    return typeof stored['separator'] === 'string'
      ? { kind, sourcePaths: stored['sourcePaths'], separator: stored['separator'] }
      : { kind, sourcePaths: stored['sourcePaths'] };
  }

  const value = stored['value'];
  if (
    kind === 'fallback' &&
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
  ) {
    return { kind, value };
  }
  return null;
}

function restoreField(stored: unknown): FieldMappingInput | null {
  if (!isPlainObject(stored)) {
    return null;
  }
  const { sourcePath, targetPath, transform } = stored;
  if (typeof sourcePath !== 'string' || typeof targetPath !== 'string') {
    return null;
  }

  if (transform === undefined || transform === null) {
    return { sourcePath, targetPath };
  }
  if (!isPlainObject(transform)) {
    return null;
  }

  const restored = restoreTransform(transform);
  return restored === null ? null : { sourcePath, targetPath, transform: restored };
}

/**
 * Reads a stored mapping, the counterpart of `restoreWebsiteTheme` for data
 * that may predate a rule. It re-runs every structural invariant, so a
 * stored mapping that no longer validates (a canonical field was removed, a
 * limit was lowered) yields `null` instead of reaching a fetch. `required`
 * is never read from storage: it is derived again from the canonical kinds.
 * This is the only way stored mapping data enters the system.
 */
export function restoreDatasetMapping(
  canonicalKind: CanonicalKind,
  stored: unknown,
): DatasetMapping | null {
  if (!isPlainObject(stored) || !Array.isArray(stored['fields'])) {
    return null;
  }
  // Bound the stored array before walking it: a blob is data, not trusted input.
  if (stored['fields'].length > MAPPING_LIMITS.maxFields) {
    return null;
  }

  const fields: FieldMappingInput[] = [];
  for (const entry of stored['fields']) {
    const field = restoreField(entry);
    if (field === null) {
      return null;
    }
    fields.push(field);
  }

  const mapping = createDatasetMapping(canonicalKind, { fields });
  return mapping.isErr() ? null : mapping.value;
}
