import { useId } from 'react';

import { Button } from '@components/ui/button';

export interface CancelConfirmationProps {
  readonly message: string;
  readonly confirmLabel: string;
  readonly keepLabel: string;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onKeep: () => void;
}

/** Cancelling cannot be undone, so it is confirmed in a dialog of its own (staff and visitors alike). */
export function CancelConfirmation({
  message,
  confirmLabel,
  keepLabel,
  isPending,
  onConfirm,
  onKeep,
}: CancelConfirmationProps) {
  const labelId = useId();

  return (
    <div
      role="alertdialog"
      aria-labelledby={labelId}
      className="space-y-3 rounded-token border border-danger-border bg-danger-subtle p-4"
    >
      <p id={labelId} className="text-sm font-medium text-danger">
        {message}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onKeep}>
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}
