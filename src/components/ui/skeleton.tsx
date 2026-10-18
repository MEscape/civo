import type { HTMLAttributes } from 'react';

import { cn } from '@lib/utils';

/**
 * Animated loading placeholder, in the theme's border colour: darker than
 * both the page (`canvas`) and a panel (`surface`), so a block shows on
 * either. Never a raw gray: it tracks the current theme.
 *
 * A block is decorative and hidden from assistive technology: the region it
 * stands in for marks itself `aria-busy` and announces loading once.
 */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-token bg-border', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
