import { describe, expect, it } from 'vitest';

import {
  MAX_HISTORY_ENTRIES,
  canRedo,
  canUndo,
  commitSnapshot,
  createHistory,
  finishPropsEdit,
  isDirty,
  markSaved,
  redoEdit,
  selectNodeInHistory,
  undoEdit,
  updatePropsInPlace,
} from '@modules/builder/domain/history/document-history';
import { toPageNodeId } from '@modules/builder/domain/models/ids';
import type { PageNode } from '@modules/builder/domain/models/page-node';

describe('document-history domain logic', () => {
  const node1: PageNode = {
    id: toPageNodeId('node-1'),
    type: 'text',
    props: { content: 'Initial' },
    children: [],
  };

  const node2: PageNode = {
    id: toPageNodeId('node-2'),
    type: 'text',
    props: { content: 'Second' },
    children: [],
  };

  it('creates initial history with baseline saved children', () => {
    const history = createHistory([node1]);
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(0);
    expect(history.present.children).toEqual([node1]);
    expect(history.present.selectedNodeId).toBeNull();
    expect(history.isCoalescingProps).toBe(false);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(isDirty(history)).toBe(false);
  });

  it('commits snapshot and discards redo future', () => {
    let history = createHistory([node1]);
    history = commitSnapshot(history, { children: [node1, node2], selectedNodeId: node2.id });

    expect(canUndo(history)).toBe(true);
    expect(history.past).toHaveLength(1);
    expect(history.past[0]?.children).toEqual([node1]);
    expect(history.present.children).toEqual([node1, node2]);
    expect(isDirty(history)).toBe(true);

    // Undo then commit new branch
    history = undoEdit(history);
    expect(canRedo(history)).toBe(true);
    const node3: PageNode = { id: toPageNodeId('node-3'), type: 'button', props: {}, children: [] };
    history = commitSnapshot(history, { children: [node3], selectedNodeId: null });
    expect(history.future).toHaveLength(0); // redo future was cleared
  });

  it('coalesces consecutive prop edits into a single undo step', () => {
    let history = createHistory([node1]);

    // First keystroke
    const edited1 = [{ ...node1, props: { content: 'I' } }];
    history = updatePropsInPlace(history, edited1);
    expect(history.isCoalescingProps).toBe(true);
    expect(history.past).toHaveLength(1);

    // Second keystroke
    const edited2 = [{ ...node1, props: { content: 'In' } }];
    history = updatePropsInPlace(history, edited2);
    expect(history.past).toHaveLength(1); // still 1 entry in past!
    expect(history.present.children).toEqual(edited2);

    // Third keystroke
    const edited3 = [{ ...node1, props: { content: 'Init' } }];
    history = updatePropsInPlace(history, edited3);
    expect(history.past).toHaveLength(1);

    // Finish props edit (e.g. blur or enter)
    history = finishPropsEdit(history);
    expect(history.isCoalescingProps).toBe(false);

    // Undoing takes us straight back to initial state before the typing started
    history = undoEdit(history);
    expect(history.present.children).toEqual([node1]);
  });

  it('selects node without creating an undo step', () => {
    let history = createHistory([node1]);
    history = selectNodeInHistory(history, node1.id);

    expect(history.present.selectedNodeId).toBe(node1.id);
    expect(history.past).toHaveLength(0);
    expect(canUndo(history)).toBe(false);
  });

  it('handles undo and redo navigation correctly', () => {
    let history = createHistory([node1]);
    history = commitSnapshot(history, { children: [node1, node2], selectedNodeId: null });

    // Calling undo at start
    const atStart = undoEdit(createHistory([node1]));
    expect(atStart.past).toHaveLength(0);

    // Calling redo at end
    const atEnd = redoEdit(history);
    expect(atEnd.future).toHaveLength(0);

    // Undo from state 1
    history = undoEdit(history);
    expect(history.present.children).toEqual([node1]);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(true);

    // Redo back to state 1
    history = redoEdit(history);
    expect(history.present.children).toEqual([node1, node2]);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
  });

  it('marks saved baseline and computes dirty state', () => {
    let history = createHistory([node1]);
    expect(isDirty(history)).toBe(false);

    history = commitSnapshot(history, { children: [node1, node2], selectedNodeId: null });
    expect(isDirty(history)).toBe(true);

    history = markSaved(history, [node1, node2]);
    expect(isDirty(history)).toBe(false);

    // Undo back to node1 now makes it dirty relative to saved state
    history = undoEdit(history);
    expect(isDirty(history)).toBe(true);
  });

  it('bounds past history to MAX_HISTORY_ENTRIES', () => {
    let history = createHistory([]);
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 20; i++) {
      const newNode: PageNode = {
        id: toPageNodeId(`n-${i}`),
        type: 'text',
        props: {},
        children: [],
      };
      history = commitSnapshot(history, { children: [newNode], selectedNodeId: null });
    }

    expect(history.past).toHaveLength(MAX_HISTORY_ENTRIES);
  });
});
