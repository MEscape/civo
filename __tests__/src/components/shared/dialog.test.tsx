import { useState } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@components/shared/dialog';

function DialogHarness({ isPending = false }: { readonly isPending?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Manage Ada
      </button>
      <ConfirmDialog
        open={open}
        title="Ada's access"
        description="Only this website"
        confirmLabel="Save"
        confirmVariant="default"
        cancelLabel="Cancel"
        isPending={isPending}
        onCancel={() => {
          setOpen(false);
        }}
        onConfirm={() => {
          setOpen(false);
        }}
      >
        <label htmlFor="role">Role</label>
        <input id="role" defaultValue="viewer" />
      </ConfirmDialog>
    </>
  );
}

describe('ConfirmDialog', () => {
  it('opens a named dialog, focuses cancellation and handles the native cancel event', async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Manage Ada' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: "Ada's access" });
    expect(dialog).toHaveAccessibleDescription('Only this website');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not dismiss or resubmit while a mutation is pending', async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Saving access"
        confirmLabel="Save"
        confirmVariant="default"
        cancelLabel="Cancel"
        isPending
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Saving access' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute('aria-busy', 'true');
  });
});
