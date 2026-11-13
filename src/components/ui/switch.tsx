'use client';

import type { ComponentProps } from 'react';

import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@lib/utils';

/**
 * Switch: Radix implementation mapped to Civo design tokens. One `switch` role with an on/off
 * state: name it with a `<label htmlFor>` or `aria-label`. The checked track is primary and the
 * thumb moves, so the state is told by position as well as by colour. Focus uses `ring-focus`
 * like the rest of the system.
 */
function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-in-out',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-4',
          'motion-reduce:transition-none',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
