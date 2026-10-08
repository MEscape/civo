import type { UnexpectedAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { assertNever, isJsonRecord, isJsonValue, isPlainObject } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { releaseMigrationPlanCorrupted } from '../errors/release-errors';

import { isNodeMigrationStatus, isUnresolvableReason } from './migration-plan';
import { toStoredJson } from './stored-json';

import type { MigrationPlan, NodeMigrationPlan, PageMigrationPlan } from './migration-plan';
import type { FieldConflict } from './three-way-merge';

/**
 * Lets a future build recognise an older stored plan without guessing from
 * its structure. Bump it whenever the stored shape changes.
 */
export const STORED_PLAN_SCHEMA_VERSION = 1;

/**
 * The single definition of the stored form of a plan, in both directions:
 * `serializeMigrationPlan` writes it and `restoreMigrationPlan` reads it, so
 * persistence knows nothing about either. A round trip, because the domain
 * keeps absent values as `undefined`, which a JSON column cannot hold.
 */
export function serializeMigrationPlan(plan: MigrationPlan): JsonValue {
  return toStoredJson({
    schemaVersion: STORED_PLAN_SCHEMA_VERSION,
    pages: plan.pages,
  });
}

/** Reads every item or none: a partly readable list is a corrupted list. */
function readAll<T>(raw: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const items: T[] = [];
  for (const item of raw as unknown[]) {
    const value = read(item);
    if (value === null) {
      return null;
    }
    items.push(value);
  }
  return items;
}

function readString(raw: unknown): string | null {
  return typeof raw === 'string' ? raw : null;
}

/** A JSON value that may be absent: `undefined` is "the key does not exist". */
function isOptionalJson(raw: unknown): raw is JsonValue | undefined {
  return raw === undefined || isJsonValue(raw);
}

function readConflict(raw: unknown): FieldConflict | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  const { kind, key, base, local, incoming } = raw;
  if (typeof key !== 'string' || !isOptionalJson(base)) {
    return null;
  }

  switch (kind) {
    case 'both_changed':
      return isOptionalJson(local) && isJsonValue(incoming)
        ? { kind, key, base, local, incoming }
        : null;
    case 'removed_upstream':
      return isJsonValue(local) ? { kind, key, base, local } : null;
    default:
      return null;
  }
}

/** What every node plan has, whatever its status. */
function readNodeHeader(raw: unknown) {
  if (!isPlainObject(raw)) {
    return null;
  }
  const { nodeId, type, fromVersion, status } = raw;
  return typeof nodeId === 'string' &&
    typeof type === 'string' &&
    typeof fromVersion === 'number' &&
    typeof status === 'string' &&
    isNodeMigrationStatus(status)
    ? { raw, status, base: { nodeId, type, fromVersion } }
    : null;
}

/** The part an upgradable and a reviewable node share: the target version and the merged props. */
function readUpgrade(raw: Readonly<Record<string, unknown>>) {
  const { toVersion, mergedProps } = raw;
  const addedFields = readAll(raw['addedFields'], readString);
  return typeof toVersion === 'number' && isJsonRecord(mergedProps) && addedFields !== null
    ? { toVersion, mergedProps, addedFields }
    : null;
}

function readNodePlan(item: unknown): NodeMigrationPlan | null {
  const header = readNodeHeader(item);
  if (header === null) {
    return null;
  }
  const { raw, status, base } = header;

  switch (status) {
    case 'unchanged': {
      const { toVersion } = raw;
      return typeof toVersion === 'number' ? { ...base, status, toVersion } : null;
    }
    case 'upgradable': {
      const upgrade = readUpgrade(raw);
      return upgrade === null ? null : { ...base, status, ...upgrade };
    }
    case 'needs_review': {
      const upgrade = readUpgrade(raw);
      const conflicts = readAll(raw['conflicts'], readConflict);
      return upgrade === null || conflicts === null
        ? null
        : { ...base, status, ...upgrade, conflicts };
    }
    case 'unresolvable': {
      const { reason } = raw;
      return typeof reason === 'string' && isUnresolvableReason(reason)
        ? { ...base, status, reason }
        : null;
    }
    default:
      return assertNever(status);
  }
}

function readPagePlan(raw: unknown): PageMigrationPlan | null {
  if (!isPlainObject(raw) || typeof raw['path'] !== 'string') {
    return null;
  }
  const nodes = readAll(raw['nodes'], readNodePlan);
  return nodes === null ? null : { path: raw['path'], nodes };
}

/**
 * Reads a stored plan back through the same invariants it was written
 * with. A plan that fails is corrupted (or from a schema version this build
 * does not understand) and must never be applied, not even partially.
 */
export function restoreMigrationPlan(
  stored: unknown,
): AppResult<MigrationPlan, UnexpectedAppError> {
  const pages =
    isPlainObject(stored) && stored['schemaVersion'] === STORED_PLAN_SCHEMA_VERSION
      ? readAll(stored['pages'], readPagePlan)
      : null;

  return pages === null
    ? err(
        releaseMigrationPlanCorrupted(
          new TypeError('The stored migration plan has an unknown shape.'),
        ),
      )
    : ok({ pages });
}
