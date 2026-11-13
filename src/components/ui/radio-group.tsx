'use client';

import type { ComponentPropsWithoutRef } from 'react';
import React, { forwardRef } from 'react';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '@lib/utils';

/**
 * RadioGroup — Radix implementation mapped to Civo design tokens.
 *
 * The group is one `radiogroup` that the arrow keys move through (roving focus), and every item is a
 * `radio`: name it with a `<label htmlFor>` or `aria-label`. Unchecked: a ring in the strong border
 * color (WCAG 1.4.11 non-text contrast). Checked: the ring turns primary and a dot appears, so the
 * choice is told by shape as well as by color. Focus uses `ring-focus` like the rest of the system.
 *
 * React 19: uses `React.ComponentRef<>` instead of deprecated `React.ElementRef<>`.
 */
const RadioGroup = forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    data-slot="radio-group"
    className={cn('grid gap-3', className)}
    {...props}
  />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    data-slot="radio-group-item"
    className={cn(
      'inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full',
      'border-2 border-border-strong bg-surface transition-colors',
      'data-[state=checked]:border-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator
      data-slot="radio-group-indicator"
      className="block size-2 rounded-full bg-primary"
    />
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
