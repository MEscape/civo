import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  UnsavedChangesContext,
  useReportUnsavedChanges,
  useUnsavedChangesRegistry,
} from '@hooks/use-unsaved-changes';

function Form({ name }: { readonly name: string }) {
  const [isDirty, setIsDirty] = useState(false);
  useReportUnsavedChanges(isDirty);
  return (
    <>
      <button
        onClick={() => {
          setIsDirty(true);
        }}
      >
        Edit {name}
      </button>
      <button
        onClick={() => {
          setIsDirty(false);
        }}
      >
        Save {name}
      </button>
    </>
  );
}

function Screen({ onNavigate }: { readonly onNavigate: () => void }) {
  const { registry, navigation } = useUnsavedChangesRegistry();
  return (
    <UnsavedChangesContext value={registry}>
      <Form name="general" />
      <Form name="theme" />
      <a
        href="/next"
        onClick={(event) => {
          event.preventDefault();
          onNavigate();
        }}
      >
        Next
      </a>
      {navigation.isPrompting && (
        <div role="alert">
          Unsaved
          <button onClick={navigation.cancel}>Stay</button>
          <button onClick={navigation.confirm}>Discard</button>
        </div>
      )}
    </UnsavedChangesContext>
  );
}

describe('coordinated unsaved changes', () => {
  it('protects the second dirty form after the first form saves', () => {
    const navigate = vi.fn();
    render(<Screen onNavigate={navigate} />);
    fireEvent.click(screen.getByText('Edit general'));
    fireEvent.click(screen.getByText('Edit theme'));
    fireEvent.click(screen.getByText('Save general'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByRole('alert')).toHaveTextContent('Unsaved');
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Stay'));
    fireEvent.click(screen.getByText('Save theme'));
    fireEvent.click(screen.getByText('Next'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('replays confirmed navigation once', () => {
    const navigate = vi.fn();
    render(<Screen onNavigate={navigate} />);
    fireEvent.click(screen.getByText('Edit general'));
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Discard'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retains browser unload protection for a standalone dirty form', () => {
    render(<Form name="standalone" />);
    fireEvent.click(screen.getByText('Edit standalone'));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
