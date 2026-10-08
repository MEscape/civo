import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@lib/utils';

/**
 * Button variants mapped entirely to Civo design tokens.
 *
 * Variant map:
 *   default     → primary brand fill
 *   secondary   → secondary brand fill
 *   accent      → accent brand fill, for a call to action on a primary-filled surface
 *   outline     → transparent with border, fills on hover
 *   ghost       → no border or fill, canvas on hover
 *   destructive → danger semantic tokens (soft, not alarming by default)
 *   link        → inline text link style using primary-copy for readability
 *
 * Size map uses Tailwind scale utilities only — no arbitrary px/rem values.
 * Focus ring uses `ring-accent` to stay on brand across all themes.
 */
const buttonVariants = cva(
  [
    'group/button inline-flex shrink-0 items-center justify-center',
    'rounded-token border border-transparent bg-clip-padding',
    'text-sm font-medium whitespace-nowrap transition-all outline-none select-none',
    // Focus: accent-colored ring consistent across themes
    'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/50',
    'active:not-aria-[haspopup]:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50',
    // Validation error state uses danger semantic tokens
    'aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Primary brand fill — use for the main CTA on a surface. */
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        /** Secondary brand fill. */
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        /** Accent brand fill — a call to action placed on a primary-filled surface. */
        accent: 'bg-accent text-accent-foreground hover:bg-accent/80',
        /** Transparent with border; fills to canvas on hover. */
        outline: [
          'border-border bg-surface',
          'hover:bg-canvas hover:text-copy',
          'aria-expanded:bg-canvas aria-expanded:text-copy',
        ],
        /** No border or fill; canvas on hover. For icon buttons and nav items. */
        ghost: [
          'hover:bg-canvas hover:text-copy',
          'aria-expanded:bg-canvas aria-expanded:text-copy',
        ],
        /**
         * Soft danger — background uses danger-subtle, text uses danger.
         * Does not use the raw danger fill; that would be too alarming for
         * most delete/remove actions. Use `variant="default"` with a
         * `bg-danger` override only for irreversible destructive actions.
         */
        destructive: [
          'bg-danger-subtle text-danger border-danger-border',
          'hover:bg-danger-subtle/80',
          'focus-visible:border-danger/40 focus-visible:ring-danger/20',
        ],
        /**
         * Inline text link. Uses `text-primary-copy` — the darkened brand
         * color that meets 4.5:1 contrast as text (not the raw brand fill).
         */
        link: 'text-primary-copy underline-offset-4 hover:underline',
      },
      size: {
        /** Standard touch target (h-8 = 32 px). */
        default:
          'h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        /** Compact, for dense UIs. */
        sm: 'h-7 gap-1 rounded-token-sm px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
        /** Prominent CTA. */
        lg: 'h-10 gap-2 px-4',
        /** Square icon-only button. */
        icon: 'size-8',
        'icon-sm': 'size-7 rounded-token-sm',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
