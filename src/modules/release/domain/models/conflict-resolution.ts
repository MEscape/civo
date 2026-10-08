import { fieldPath } from '@lib/errors';
import type { FieldErrorBag, ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isJsonValue, jsonWeight, literalGuard } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import {
  RELEASE_VALIDATION_CODES as CODES,
  createReleaseValidationBag,
} from '../errors/release-errors';

import { toStoredJson } from './stored-json';

import type { MigrationPlan } from './migration-plan';
import type { FieldConflict } from './three-way-merge';

export const RESOLUTION_ACTIONS = ['keep_local', 'use_new', 'custom'] as const;
export type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number];
export const isResolutionAction = literalGuard(RESOLUTION_ACTIONS);

/**
 * Bounds for a hand-typed value. A resolution is externally reachable
 * input that ends up inside a stored page (security.md), so it is capped
 * like any other page content.
 */
export const CUSTOM_VALUE_LIMITS = { maxDepth: 8, maxWeight: 10_000 } as const;

/**
 * The single definition of "an acceptable hand-typed value". The server
 * decides with it, and the review form re-exports it (through the
 * contracts) to warn before submitting, so the two can never disagree.
 */
export function isAcceptableCustomValue(value: unknown): value is JsonValue {
  return (
    isJsonValue(value, CUSTOM_VALUE_LIMITS.maxDepth) &&
    jsonWeight(value) <= CUSTOM_VALUE_LIMITS.maxWeight
  );
}

export type ConflictResolution =
  | { readonly action: 'keep_local' }
  | { readonly action: 'use_new' }
  | { readonly action: 'custom'; readonly value: JsonValue };

type NodeResolutions = Readonly<Record<string, ConflictResolution>>;
type PageResolutions = Readonly<Record<string, NodeResolutions>>;

/** Page path -> node id -> field key. A node id is only unique within its page. */
export type ConflictResolutions = Readonly<Record<string, PageResolutions>>;

/** An untrusted resolution, shaped like `ConflictResolution` but not yet checked. */
export interface ConflictResolutionInput {
  readonly action: string;
  readonly value?: unknown;
}

export type ConflictResolutionsInput = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, ConflictResolutionInput>>>>>
>;

const HOME_PAGE_FIELD = 'home';

type ConflictsByField = ReadonlyMap<string, FieldConflict>;
type ConflictsByNode = ReadonlyMap<string, ConflictsByField>;
type ConflictsByPage = ReadonlyMap<string, ConflictsByNode>;

/** What the plan flagged: the only things a resolution may name. */
function conflictsOf(plan: MigrationPlan): ConflictsByPage {
  return new Map(
    plan.pages.map((page) => [
      page.path,
      new Map(
        page.nodes.flatMap((node) =>
          node.status === 'needs_review'
            ? [
                [
                  node.nodeId,
                  new Map(node.conflicts.map((conflict) => [conflict.key, conflict] as const)),
                ] as const,
              ]
            : [],
        ),
      ),
    ]),
  );
}

/** Where an error is reported, and the bag it goes into. */
interface FieldReport {
  readonly field: string;
  readonly bag: FieldErrorBag;
}

function parseResolution(
  input: ConflictResolutionInput,
  conflict: FieldConflict,
  { field, bag }: FieldReport,
): ConflictResolution | null {
  if (!isResolutionAction(input.action)) {
    bag.add(field, CODES.resolutionActionInvalid);
    return null;
  }
  if (input.action !== 'custom') {
    return { action: input.action };
  }

  // A removed field is not read by the new version, so a new value for it is meaningless.
  if (conflict.kind === 'removed_upstream') {
    bag.add(field, CODES.resolutionActionInvalid);
    return null;
  }
  if (!isAcceptableCustomValue(input.value)) {
    bag.add(field, CODES.resolutionValueInvalid);
    return null;
  }
  return { action: 'custom', value: input.value };
}

function parseNodeResolutions(
  fields: Readonly<Record<string, ConflictResolutionInput>>,
  known: ConflictsByField,
  { field: nodeField, bag }: FieldReport,
): NodeResolutions {
  const parsed: Record<string, ConflictResolution> = {};

  for (const [key, input] of Object.entries(fields)) {
    const field = fieldPath(nodeField, key);
    const conflict = known.get(key);
    if (conflict === undefined) {
      bag.add(field, CODES.resolutionFieldUnknown);
      continue;
    }
    const resolution = parseResolution(input, conflict, { field, bag });
    if (resolution !== null) {
      parsed[key] = resolution;
    }
  }
  return parsed;
}

function parsePageResolutions(
  nodes: ConflictResolutionsInput[string],
  known: ConflictsByNode,
  { field: pageField, bag }: FieldReport,
): PageResolutions {
  const parsed: Record<string, NodeResolutions> = {};

  for (const [nodeId, fields] of Object.entries(nodes)) {
    const field = fieldPath(pageField, nodeId);
    const knownFields = known.get(nodeId);
    if (knownFields === undefined) {
      bag.add(field, CODES.resolutionNodeUnknown);
      continue;
    }
    parsed[nodeId] = parseNodeResolutions(fields, knownFields, { field, bag });
  }
  return parsed;
}

/**
 * Validates untrusted resolutions AGAINST the stored plan: a resolution may
 * only name a page, node and field that the reviewed plan actually flagged.
 * Everything else is rejected, so a client cannot write to nodes the
 * reviewer never saw. Reports every problem at once.
 *
 * Missing resolutions are fine: an unresolved node is skipped untouched.
 */
export function parseConflictResolutions(
  input: ConflictResolutionsInput,
  plan: MigrationPlan,
): AppResult<ConflictResolutions, ValidationAppError> {
  const bag = createReleaseValidationBag();
  const known = conflictsOf(plan);
  const parsed: Record<string, PageResolutions> = {};

  for (const [path, nodes] of Object.entries(input)) {
    const field = fieldPath('resolutions', path === '' ? HOME_PAGE_FIELD : path);
    const knownNodes = known.get(path);
    if (knownNodes === undefined) {
      bag.add(field, CODES.resolutionPageUnknown);
      continue;
    }
    parsed[path] = parsePageResolutions(nodes, knownNodes, { field, bag });
  }

  return bag.hasErrors ? err(bag.toError()) : ok(parsed);
}

/** The plain JSON form of the chosen resolutions, for the audit column. */
export function serializeConflictResolutions(resolutions: ConflictResolutions): JsonValue {
  return toStoredJson(resolutions);
}
