import type { HTMLAttributes } from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@lib/utils';

/**
 * Alert banner. Uses the same four-variant semantic token triplet as Badge:
 * success/warning/danger/info — each with solid text, subtle bg, and border.
 *
 * Design intent: status tokens are STATIC — a website theme cannot change what
 * "danger" looks like. See globals.css §Semantic status tokens.
 */
const alertVariants = cva('relative w-full rounded-token border p-4', {
  variants: {
    variant: {
      default: 'border-border bg-canvas text-copy',
      success: 'border-success-border bg-success-subtle text-success',
      warning: 'border-warning-border bg-warning-subtle text-warning',
      danger: 'border-danger-border bg-danger-subtle text-danger',
      info: 'border-info-border bg-info-subtle text-info',
    },
  },
  defaultVariants: { variant: 'default' },
});

interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        alertVariants({ variant }),
        '[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:pl-7',
        className,
      )}
      {...props}
    />
  );
}

/** A paragraph, not a heading: an alert's title must not enter the page's heading outline. */
function AlertTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

/** A block, not a paragraph: its text may hold paragraphs and lists of its own, which a `<p>` cannot. */
function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
