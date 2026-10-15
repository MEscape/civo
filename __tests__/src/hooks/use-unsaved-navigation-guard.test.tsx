import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfirmDialog } from '@components/shared/confirm-dialog';

import { useUnsavedNavigationGuard } from '@hooks/use-unsaved-navigation-guard';

/** The links the page would follow: it stands in for the framework's `Link`, which runs after the guard. */
let followed: string[] = [];
function recordNavigation(event: Event): void {
  const anchor = (event.target as Element).closest('a');
  if (anchor !== null) {
    followed.push(anchor.getAttribute('href') ?? '');
    event.preventDefault();
  }
}

function Page({ isDirty }: { readonly isDirty: boolean }) {
  const guard = useUnsavedNavigationGuard(isDirty);
  const [draft, setDraft] = useState('first draft');

  return (
    <>
      <input
        aria-label="Draft"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <a href="/websites/w1">Overview</a>
      <a href="/websites/w1/bookings" target="_blank">
        Other tab
      </a>
      <a href="https://example.org/page">External</a>
      <a href="#top">Same page</a>
      <button
        type="button"
        data-navigation-guard-leaves=""
        onClick={() => {
          followed.push('sign-out');
        }}
      >
        Sign out
      </button>
      <div data-navigation-guard-ignore="">
        <a href="/inside-the-canvas">Canvas link</a>
      </div>
      <ConfirmDialog
        open={guard.isPrompting}
        title="Leave?"
        description="Changes are lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={guard.confirm}
        onCancel={guard.cancel}
      />
    </>
  );
}

const dialog = () => document.querySelector('dialog');

beforeEach(() => {
  followed = [];
  document.addEventListener('click', recordNavigation);
});
afterEach(() => {
  document.removeEventListener('click', recordNavigation);
});

describe('useUnsavedNavigationGuard', () => {
  it('lets links through while nothing is unsaved', () => {
    render(<Page isDirty={false} />);

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    expect(followed).toEqual(['/websites/w1']);
    expect(dialog()?.open).toBe(false);
  });

  it('holds back an in-app link while unsaved and asks first', () => {
    render(<Page isDirty />);

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    expect(followed).toEqual([]);
    expect(dialog()?.open).toBe(true);
    expect(screen.getByRole('alertdialog', { name: 'Leave?' })).toHaveAccessibleDescription(
      'Changes are lost.',
    );
  });

  it('keeps the page and the draft when the visitor stays', () => {
    render(<Page isDirty />);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'second draft' } });
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    expect(followed).toEqual([]);
    expect(dialog()?.open).toBe(false);
    expect(screen.getByLabelText('Draft')).toHaveValue('second draft');
  });

  it('treats Escape as staying', () => {
    render(<Page isDirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    fireEvent(dialog()!, new Event('cancel', { cancelable: true }));

    expect(followed).toEqual([]);
    expect(dialog()?.open).toBe(false);
  });

  it('follows exactly the held link once the visitor leaves', () => {
    render(<Page isDirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    expect(followed).toEqual(['/websites/w1']);
    expect(dialog()?.open).toBe(false);
  });

  it('asks again for the next link after the visitor stayed', () => {
    render(<Page isDirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    expect(dialog()?.open).toBe(true);
  });

  it.each([
    ['opens in another tab', 'Other tab'],
    ['leads to another site (the browser asks on unload)', 'External'],
    ['stays on the same page', 'Same page'],
    ['sits in a region that never navigates', 'Canvas link'],
  ])('ignores a link that %s', (_case, name) => {
    render(<Page isDirty />);

    fireEvent.click(screen.getByRole('link', { name }));

    expect(dialog()?.open).toBe(false);
    expect(followed).toHaveLength(1);
  });

  it('ignores a click with a modifier key, which opens a new tab', () => {
    render(<Page isDirty />);

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }), { ctrlKey: true });

    expect(dialog()?.open).toBe(false);
    expect(followed).toEqual(['/websites/w1']);
  });

  it('stops holding links back once the changes are saved', () => {
    const { rerender } = render(<Page isDirty />);
    rerender(<Page isDirty={false} />);

    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    expect(followed).toEqual(['/websites/w1']);
  });

  it('asks before a control that ends the visit by itself, such as sign-out', () => {
    render(<Page isDirty />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(followed).toEqual([]);
    expect(dialog()?.open).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(followed).toEqual(['sign-out']);
  });

  it('lets sign-out through while nothing is unsaved', () => {
    render(<Page isDirty={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(followed).toEqual(['sign-out']);
  });

  it('closes the question without leaving when the changes get saved meanwhile', () => {
    const { rerender } = render(<Page isDirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));

    rerender(<Page isDirty={false} />);

    expect(dialog()?.open).toBe(false);
    expect(followed).toEqual([]);
  });

  it('follows the link only once when "Leave" is pressed twice', () => {
    render(<Page isDirty />);
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }));
    const leave = screen.getByRole('button', { name: 'Leave' });

    fireEvent.click(leave);
    fireEvent.click(leave);

    expect(followed).toEqual(['/websites/w1']);
  });
});
