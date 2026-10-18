import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  UnsavedChangesGuard,
  useReportUnsavedChanges,
} from '@components/shared/unsaved-changes-guard';

/** Stands in for the framework's `Link`, which runs after the guard. */
let followed: string[] = [];
function recordNavigation(event: Event): void {
  const anchor = (event.target as Element).closest('a');
  if (anchor !== null) {
    followed.push(anchor.getAttribute('href') ?? '');
    event.preventDefault();
  }
}

function DraftForm() {
  const [draft, setDraft] = useState('saved');
  useReportUnsavedChanges(draft !== 'saved');
  return (
    <input
      aria-label="Draft"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
    />
  );
}

function Screen() {
  return (
    <UnsavedChangesGuard
      title="Leave?"
      description="Changes are lost."
      confirmLabel="Discard"
      cancelLabel="Stay"
    >
      <DraftForm />
      <a href="/elsewhere">Elsewhere</a>
    </UnsavedChangesGuard>
  );
}

beforeEach(() => {
  followed = [];
  document.addEventListener('click', recordNavigation);
});
afterEach(() => {
  document.removeEventListener('click', recordNavigation);
});

describe('UnsavedChangesGuard', () => {
  // Cache Components keep a left page mounted but hidden, so a discard must reset the forms itself.
  it('resets the forms when the visitor discards and leaves', () => {
    render(<Screen />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved' } });
    fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(followed).toEqual(['/elsewhere']);
    expect(screen.getByLabelText('Draft')).toHaveValue('saved');
  });

  it('keeps the draft when the visitor stays', () => {
    render(<Screen />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved' } });
    fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }));

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    expect(followed).toEqual([]);
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved');
  });
});
