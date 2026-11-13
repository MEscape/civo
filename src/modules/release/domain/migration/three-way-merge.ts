import { deepEqual, unique } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import type { NodeProps } from './page-tree';

/**
 * A field that cannot be merged without a human decision. Absent values
 * (`undefined`) mean "the key does not exist", which is different from a
 * stored JSON `null`.
 */
export type FieldConflict =
  | {
      /** The editor and the new component version both changed it, to different values. */
      readonly kind: 'both_changed';
      readonly key: string;
      readonly base?: JsonValue | undefined;
      readonly local?: JsonValue | undefined;
      readonly incoming: JsonValue;
    }
  | {
      /**
       * The new component version dropped this field, but the editor had
       * customised it. Dropping it silently would lose their work.
       */
      readonly kind: 'removed_upstream';
      readonly key: string;
      readonly base?: JsonValue | undefined;
      readonly local: JsonValue;
    };

export interface ThreeWayMergeResult {
  /** Every field that merged cleanly, plus LOCAL's value for each conflict that can keep one. */
  readonly merged: NodeProps;
  readonly conflicts: readonly FieldConflict[];
  /**
   * Keys that exist only in NEXT: a field the upgraded component
   * introduces. Reported for visibility; they never conflict because
   * nothing existed for the editor to have customised.
   */
  readonly addedFields: readonly string[];
}

type FieldMerge =
  | { readonly kind: 'value'; readonly value: JsonValue | undefined }
  | { readonly kind: 'added'; readonly value: JsonValue }
  | {
      readonly kind: 'conflict';
      readonly value: JsonValue | undefined;
      readonly conflict: FieldConflict;
    };

/** One field's value in each of the three versions; `undefined` means the key is absent. */
interface FieldVersions {
  readonly key: string;
  readonly base: JsonValue | undefined;
  readonly local: JsonValue | undefined;
  readonly next: JsonValue | undefined;
}

function mergeRemovedUpstream({ key, base, local }: FieldVersions): FieldMerge {
  // Nothing to protect: untouched by the editor, or already gone.
  if (local === undefined || deepEqual(base, local)) {
    return { kind: 'value', value: undefined };
  }
  // The new version will not read this field, so it is kept out of `merged`
  // and surfaced for a decision instead.
  return {
    kind: 'conflict',
    value: undefined,
    conflict: { kind: 'removed_upstream', key, base, local },
  };
}

/**
 * Classifies one field across BASE (the old version's defaults), LOCAL (the
 * editor's stored value) and NEXT (the new version's defaults). A conflict
 * keeps LOCAL until someone resolves it: NEXT is never preferred silently.
 */
function mergeField(versions: FieldVersions): FieldMerge {
  const { key, base, local, next } = versions;
  if (base === undefined && local === undefined) {
    return next === undefined
      ? { kind: 'value', value: undefined }
      : { kind: 'added', value: next };
  }
  if (next === undefined) {
    return mergeRemovedUpstream(versions);
  }

  const hasLocalChange = !deepEqual(base, local);
  const hasUpstreamChange = !deepEqual(base, next);

  if (!hasLocalChange) {
    return { kind: 'value', value: next };
  }
  if (!hasUpstreamChange || deepEqual(local, next)) {
    return { kind: 'value', value: local };
  }
  return {
    kind: 'conflict',
    value: local,
    conflict: { kind: 'both_changed', key, base, local, incoming: next },
  };
}

/**
 * Runs the three-way merge over one component's props.
 *
 * Deliberately NOT handled: field renames. Only a component's own
 * migration definition can say that `showDate` became `dateDisplay`, and it
 * would have to run BEFORE this merge. This function compares three
 * objects that already agree on what a key means.
 */
export function threeWayMergeProps(
  base: NodeProps,
  local: NodeProps,
  next: NodeProps,
): ThreeWayMergeResult {
  const merged: Record<string, JsonValue> = {};
  const conflicts: FieldConflict[] = [];
  const addedFields: string[] = [];

  const keys = unique([...Object.keys(base), ...Object.keys(local), ...Object.keys(next)]);

  for (const key of keys) {
    const outcome = mergeField({
      key,
      base: base[key],
      local: local[key],
      next: next[key],
    });

    if (outcome.value !== undefined) {
      merged[key] = outcome.value;
    }
    if (outcome.kind === 'added') {
      addedFields.push(key);
    }
    if (outcome.kind === 'conflict') {
      conflicts.push(outcome.conflict);
    }
  }

  return { merged, conflicts, addedFields };
}
