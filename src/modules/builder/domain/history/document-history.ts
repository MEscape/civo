import { deepEqual } from '@lib/utils';

import type { PageNodeId } from '../models/ids';
import type { PageNode } from '../models/page-node';

/*
 * The editor's undo/redo model as pure functions, so the Redux slice is a
 * thin adapter and the rules (limits, coalescing, dirtiness) are unit-testable
 * without a store.
 */

export interface EditorSnapshot {
  readonly children: readonly PageNode[];
  readonly selectedNodeId: PageNodeId | null;
}

export interface DocumentHistory {
  readonly past: readonly EditorSnapshot[];
  readonly present: EditorSnapshot;
  readonly future: readonly EditorSnapshot[];
  /** True while consecutive prop edits (typing) are folded into one history entry. */
  readonly isCoalescingProps: boolean;
  /** The tree as last saved (or loaded): the baseline for `isDirty`. */
  readonly savedChildren: readonly PageNode[];
}

export const MAX_HISTORY_ENTRIES = 100;

function pushPast(
  past: readonly EditorSnapshot[],
  entry: EditorSnapshot,
): readonly EditorSnapshot[] {
  return [...past, entry].slice(-MAX_HISTORY_ENTRIES);
}

export function createHistory(children: readonly PageNode[]): DocumentHistory {
  return {
    past: [],
    present: { children, selectedNodeId: null },
    future: [],
    isCoalescingProps: false,
    savedChildren: children,
  };
}

/** A discrete edit: one undo step, and any redo branch is dropped. */
export function commitSnapshot(history: DocumentHistory, next: EditorSnapshot): DocumentHistory {
  return {
    ...history,
    past: pushPast(history.past, history.present),
    present: next,
    future: [],
    isCoalescingProps: false,
  };
}

/**
 * A prop edit (a keystroke). The first one opens a history entry; the
 * following ones update the present in place until `finishPropsEdit`, so a
 * whole typing burst is a single undo step.
 */
export function updatePropsInPlace(
  history: DocumentHistory,
  children: readonly PageNode[],
): DocumentHistory {
  const present = { ...history.present, children };
  if (history.isCoalescingProps) {
    return { ...history, present };
  }
  return {
    ...history,
    past: pushPast(history.past, history.present),
    present,
    future: [],
    isCoalescingProps: true,
  };
}

export function finishPropsEdit(history: DocumentHistory): DocumentHistory {
  return history.isCoalescingProps ? { ...history, isCoalescingProps: false } : history;
}

/** Selection is not an edit: it never creates an undo step. */
export function selectNodeInHistory(
  history: DocumentHistory,
  nodeId: PageNodeId | null,
): DocumentHistory {
  return {
    ...history,
    present: { ...history.present, selectedNodeId: nodeId },
  };
}

export function undoEdit(history: DocumentHistory): DocumentHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    isCoalescingProps: false,
  };
}

export function redoEdit(history: DocumentHistory): DocumentHistory {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return {
    ...history,
    past: pushPast(history.past, history.present),
    present: next,
    future: rest,
    isCoalescingProps: false,
  };
}

/**
 * Records which tree was saved. Pass the tree that was SENT, not the
 * current one: edits made while the save was in flight must stay dirty.
 */
export function markSaved(
  history: DocumentHistory,
  savedChildren: readonly PageNode[],
): DocumentHistory {
  return { ...history, savedChildren };
}

/**
 * Derived, not stored: undoing back to the saved tree, or typing a
 * character and deleting it again, is clean again. Unchanged subtrees keep
 * their identity (structural sharing), and `deepEqual` short-circuits on
 * identity, so only the edited path is actually compared.
 */
export function isDirty(history: DocumentHistory): boolean {
  return !deepEqual(history.present.children, history.savedChildren);
}

export function canUndo(history: DocumentHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DocumentHistory): boolean {
  return history.future.length > 0;
}
