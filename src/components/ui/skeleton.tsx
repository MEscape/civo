import type { HTMLAttributes } from 'react';

import { cn } from '@lib/utils';

/**
 * Animated loading placeholder. Uses `bg-canvas` to stay on-theme.
 *
 * Rule §19: never use raw gray values for skeletons — they must track the
 * current theme's canvas color.
 *
 * A block is decorative and hidden from assistive technology: the region it
 * stands in for marks itself `aria-busy` and announces loading once.
 */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-token bg-canvas', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
