import { forwardRef } from 'react';
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cn } from '@lib/utils';

/**
 * Text input. Border uses `border-strong` (3:1 WCAG 1.4.11 for non-text
 * contrast) while the decorative field separator uses `border-border`.
 */
const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-token border border-border-strong bg-surface px-3 py-1 text-sm text-copy',
        'placeholder:text-copy-muted',
        'ring-offset-surface transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** Textarea shares the same visual contract as Input. */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded-token border border-border-strong bg-surface px-3 py-2 text-sm text-copy',
        'placeholder:text-copy-muted',
        'ring-offset-surface transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/30',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

/**
 * Form label. Associates with a control via `htmlFor`.
 * When the sibling control is invalid the label shifts to `text-danger`
 * via the `group-aria-invalid` pattern — wrap both in `<div className="group">`.
 */
function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'text-sm font-medium leading-none text-copy',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export { Input, Label, Textarea };
