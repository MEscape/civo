'use client';

import type { ComponentPropsWithoutRef } from 'react';
import React, { forwardRef } from 'react';

import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@lib/utils';

/**
 * Switch — Radix implementation mapped to Civo design tokens.
 *
 * Checked state: primary brand fill (`bg-primary`).
 * Unchecked state: strong border color (`bg-border-strong`) — meets WCAG 1.4.11
 *   non-text contrast (3:1) against the page background.
 * Thumb: white surface token so it pops on both checked and unchecked tracks.
 * Focus ring uses `ring-accent` consistent with the rest of the system.
 *
 * React 19: uses `React.ComponentRef<>` instead of deprecated `React.ElementRef<>`.
 */
const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    data-slot="switch"
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent transition-colors',
      // Checked / unchecked track colors use semantic tokens
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border-strong',
      // Focus ring uses accent token
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-4 rounded-full bg-surface shadow-sm ring-0 transition-transform',
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
