import type { HTMLAttributes } from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@lib/utils';

/**
 * Badge variants.
 *
 * Status variants (`success`, `warning`, `danger`, `info`) use the semantic
 * token triplet (solid / subtle / border) defined in globals.css.
 * `default` uses the primary brand color.
 * `outline` uses only the border token with no fill.
 * `muted` is a neutral label (a party, a department) that carries no status.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-copy',
        muted: 'border-border bg-canvas text-copy-muted',
        success: 'border-success-border bg-success-subtle text-success',
        warning: 'border-warning-border bg-warning-subtle text-warning',
        danger: 'border-danger-border bg-danger-subtle text-danger',
        info: 'border-info-border bg-info-subtle text-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
