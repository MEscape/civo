'use client';

import type { ReactNode } from 'react';

import { Label } from '@components/ui/input';
import { Switch } from '@components/ui/switch';

export interface SwitchFieldProps {
  readonly id: string;
  readonly label: string;
  /** What the switch does, below its name. */
  readonly hint: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean | undefined;
  /** A note that appears while the switch is off (what stays as it is). Read out when it appears. */
  readonly offNote?: ReactNode;
}

/** A label with its explanation and the switch at the far edge, as one accessible unit. */
export function SwitchField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  offNote,
}: SwitchFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <Label htmlFor={id}>{label}</Label>
          <p id={`${id}-hint`} className="text-xs text-copy-muted">
            {hint}
          </p>
        </div>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          aria-describedby={`${id}-hint`}
        />
      </div>
      {!checked && offNote !== undefined && (
        <p role="status" className="text-xs text-copy-muted">
          {offNote}
        </p>
      )}
    </div>
  );
}
