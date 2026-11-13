'use client';

import type { ComponentProps } from 'react';

import * as ProgressPrimitive from '@radix-ui/react-progress';

import { clamp, cn } from '@lib/utils';

const FULL_PROGRESS = 100;

/** Shadcn's Radix progress primitive, using the application's radius, color and motion tokens. */
export function Progress({
  className,
  value = 0,
  max = FULL_PROGRESS,
  ...props
}: ComponentProps<typeof ProgressPrimitive.Root>) {
  const maximum = max > 0 ? max : FULL_PROGRESS;
  const progress = value === null ? 0 : clamp(value, 0, maximum);
  return (
    <ProgressPrimitive.Root
      {...props}
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/15', className)}
      value={value === null ? null : progress}
      max={maximum}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-transform motion-reduce:transition-none"
        style={{
          transform: `translateX(-${FULL_PROGRESS - (progress / maximum) * FULL_PROGRESS}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}
