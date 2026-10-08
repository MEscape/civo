import { parseJson } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { isAcceptableCustomValue } from '../../application/contracts/release-constraints';

import type {
  ConflictResolutionsInput,
  MigrationPlanView,
  NodeMigrationView,
} from '../../application/contracts/release-views';

/**
 * What a reviewer has picked for one conflict. `custom` keeps the raw text
 * they typed, so half-typed JSON is preserved while they edit it.
 */
export type ConflictChoice =
  | { readonly action: 'keep_local' }
  | { readonly action: 'use_new' }
  | { readonly action: 'custom'; readonly text: string };

/** Keyed by `conflictKey`; a missing key means the conflict is still unresolved. */
export type ChoiceMap = Readonly<Record<string, ConflictChoice>>;

/**
 * Page paths, node ids and field keys may all contain `.` or `/`, so no
 * separator is safe; a JSON tuple is unambiguous.
 */
export function conflictKey(path: string, nodeId: string, key: string): string {
  return JSON.stringify([path, nodeId, key]);
}

type CustomValue =
  { readonly isValid: true; readonly value: JsonValue } | { readonly isValid: false };

/** Asks the server's own rule, so the reviewer is told before submitting; the server still decides. */
export function parseCustomValue(text: string): CustomValue {
  try {
    const value = parseJson(text);
    return isAcceptableCustomValue(value) ? { isValid: true, value } : { isValid: false };
  } catch {
    // Not JSON yet: the field shows the error, nothing else needs to know why.
    return { isValid: false };
  }
}

/** A custom choice whose text is not acceptable JSON blocks submitting. */
export function hasInvalidChoice(choices: ChoiceMap): boolean {
  return Object.values(choices).some(
    (choice) => choice.action === 'custom' && !parseCustomValue(choice.text).isValid,
  );
}

function isNodeUnresolved(pagePath: string, node: NodeMigrationView, choices: ChoiceMap): boolean {
  return (
    node.status === 'needs_review' &&
    node.conflicts.some(
      (conflict) => choices[conflictKey(pagePath, node.nodeId, conflict.key)] === undefined,
    )
  );
}

/** How many nodes would be skipped because not every one of their conflicts has a choice. */
export function countUnresolvedNodes(plan: MigrationPlanView, choices: ChoiceMap): number {
  return plan.pages
    .flatMap((page) => page.nodes.map((node) => isNodeUnresolved(page.path, node, choices)))
    .filter(Boolean).length;
}

type ResolutionInput = ConflictResolutionsInput[string][string][string];

function toResolution(choice: ConflictChoice): ResolutionInput | null {
  if (choice.action !== 'custom') {
    return { action: choice.action };
  }

  const custom = parseCustomValue(choice.text);
  return custom.isValid ? { action: 'custom', value: custom.value } : null;
}

function isNotEmpty(entry: readonly [string, object]): boolean {
  return Object.keys(entry[1]).length > 0;
}

/** The decided conflicts of one node, by field key. Invalid custom values are left out. */
function resolutionsForNode(
  pagePath: string,
  node: NodeMigrationView,
  choices: ChoiceMap,
): Record<string, ResolutionInput> {
  if (node.status !== 'needs_review') {
    return {};
  }

  return Object.fromEntries(
    node.conflicts.flatMap((conflict) => {
      const choice = choices[conflictKey(pagePath, node.nodeId, conflict.key)];
      const resolution = choice === undefined ? null : toResolution(choice);
      return resolution === null ? [] : [[conflict.key, resolution] as const];
    }),
  );
}

/** Nests the flat choices into the shape the action takes; pages and nodes with nothing decided are omitted. */
export function toResolutionsInput(
  plan: MigrationPlanView,
  choices: ChoiceMap,
): ConflictResolutionsInput {
  return Object.fromEntries(
    plan.pages
      .map(
        (page) =>
          [
            page.path,
            Object.fromEntries(
              page.nodes
                .map((node) => [node.nodeId, resolutionsForNode(page.path, node, choices)] as const)
                .filter(isNotEmpty),
            ),
          ] as const,
      )
      .filter(isNotEmpty),
  );
}
