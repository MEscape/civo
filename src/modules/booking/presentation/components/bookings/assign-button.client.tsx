'use client';

import { Button } from '@components/ui/button';

import { useAssignDialog } from '../../hooks/use-assign-dialog';

import { AssignDialog } from './assign-dialog.client';

import type { AssignTarget } from '../../hooks/use-assign-dialog';

export interface AssignButtonProps {
  readonly target: AssignTarget;
  readonly label: string;
  readonly variant?: 'default' | 'outline' | 'ghost';
  readonly size?: 'default' | 'sm';
  /** What a screen reader hears when the visible words are short ("Replace"). */
  readonly accessibleName?: string | undefined;
  readonly subtitle: string;
  readonly nameOf: (resourceId: string) => string;
  readonly timeZone: string;
  readonly replacesName?: string | undefined;
}

/** Opens the assignment dialog for one unit of a booking: filling it, or giving it to someone else. */
export function AssignButton({
  target,
  label,
  variant = 'default',
  size = 'default',
  accessibleName,
  subtitle,
  nameOf,
  timeZone,
  replacesName,
}: AssignButtonProps) {
  const dialog = useAssignDialog(target);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={accessibleName}
        onClick={dialog.open}
      >
        {label}
      </Button>
      <AssignDialog
        dialog={dialog}
        subtitle={subtitle}
        nameOf={nameOf}
        timeZone={timeZone}
        replacesName={replacesName}
      />
    </>
  );
}
