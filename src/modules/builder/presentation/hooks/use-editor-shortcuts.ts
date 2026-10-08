import { useEffect } from 'react';

import { isEditableTarget } from '../dom/editable-target';
import { editRedone, editUndone, nodeSelected } from '../state/builder-actions';
import { useBuilderDispatch } from '../state/builder-hooks';
import { removeSelectedNode } from '../state/editing-thunks';
import { saveDraft } from '../state/save-thunk';

type Shortcut = 'save' | 'undo' | 'redo' | 'deselect' | 'delete';

/** Ctrl/Cmd combinations. */
function modifiedShortcut(key: string, shiftKey: boolean): Shortcut | null {
  if (key === 's') {
    return 'save';
  }
  if (key === 'z') {
    return shiftKey ? 'redo' : 'undo';
  }
  if (key === 'y') {
    return 'redo';
  }
  return null;
}

function plainShortcut(event: KeyboardEvent, canEditStructure: boolean): Shortcut | null {
  if (event.key === 'Escape') {
    return 'deselect';
  }
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
  return canEditStructure && isDeleteKey && event.target === document.body ? 'delete' : null;
}

/**
 * Editor shortcuts. Thunks read the current state themselves, so this
 * listener subscribes once. Save works everywhere; undo, redo, escape and
 * delete never hijack text editing, and delete only acts when nothing
 * else has focus and the session may change the structure.
 */
export function useEditorShortcuts(canEditStructure: boolean): void {
  const dispatch = useBuilderDispatch();

  useEffect(() => {
    const actions: Record<Shortcut, () => void> = {
      save: () => {
        void dispatch(saveDraft());
      },
      undo: () => {
        dispatch(editUndone());
      },
      redo: () => {
        dispatch(editRedone());
      },
      deselect: () => {
        dispatch(nodeSelected(null));
      },
      delete: () => {
        dispatch(removeSelectedNode());
      },
    };

    function handleKeyDown(event: KeyboardEvent): void {
      const hasModifier = event.metaKey || event.ctrlKey;
      const shortcut =
        (hasModifier ? modifiedShortcut(event.key.toLowerCase(), event.shiftKey) : null) ??
        plainShortcut(event, canEditStructure);
      if (shortcut === null) {
        return;
      }
      if (shortcut !== 'save' && isEditableTarget(event.target)) {
        return;
      }
      // Escape keeps its default so open browser UI still closes.
      if (shortcut !== 'deselect') {
        event.preventDefault();
      }
      actions[shortcut]();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, canEditStructure]);
}
