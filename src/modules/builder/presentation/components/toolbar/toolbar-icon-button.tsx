import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

export interface ToolbarIconButtonProps {
  readonly icon: ReactNode;
  readonly label: string;
  /** Set only for toggles; plain actions must not announce a pressed state. */
  readonly isPressed?: boolean;
  readonly isDisabled?: boolean;
  readonly onClick: () => void;
}

export function ToolbarIconButton({
  icon,
  label,
  isPressed,
  isDisabled,
  onClick,
}: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isPressed}
      disabled={isDisabled}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-token-sm text-copy-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30',
        isPressed === true && 'bg-canvas text-copy',
        isDisabled !== true && 'hover:bg-canvas',
      )}
    >
      {icon}
    </button>
  );
}
