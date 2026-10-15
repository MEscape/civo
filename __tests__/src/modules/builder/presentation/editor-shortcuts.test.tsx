import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditorShortcuts } from '@modules/builder/presentation/hooks/use-editor-shortcuts';
import { editUndone } from '@modules/builder/presentation/state/builder-actions';

const dispatch = vi.hoisted(() => vi.fn());

vi.mock('@modules/builder/presentation/state/builder-hooks', () => ({
  useBuilderDispatch: () => dispatch,
}));
vi.mock('@modules/builder/presentation/state/save-thunk', () => ({
  saveDraft: () => 'save-draft',
}));
vi.mock('@modules/builder/presentation/state/editing-thunks', () => ({
  removeSelectedNode: () => 'remove-selected-node',
}));

function Editor() {
  useEditorShortcuts(true);
  return (
    <>
      <button type="button">Canvas control</button>
      <dialog open>
        <button type="button">Stay</button>
      </dialog>
    </>
  );
}

describe('useEditorShortcuts', () => {
  beforeEach(() => {
    dispatch.mockClear();
  });

  it('undoes and saves from the page', () => {
    const { getByRole } = render(<Editor />);
    const control = getByRole('button', { name: 'Canvas control' });

    fireEvent.keyDown(control, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(control, { key: 's', ctrlKey: true });

    expect(dispatch).toHaveBeenCalledWith(editUndone());
    expect(dispatch).toHaveBeenCalledWith('save-draft');
  });

  it('leaves the keyboard to a dialog that is open: nothing behind it changes', () => {
    const { getByRole } = render(<Editor />);
    const inDialog = getByRole('button', { name: 'Stay' });

    fireEvent.keyDown(inDialog, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(inDialog, { key: 's', ctrlKey: true });
    fireEvent.keyDown(inDialog, { key: 'Escape' });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
