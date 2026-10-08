'use client';

import type { ComponentPropsWithoutRef } from 'react';
import React, { forwardRef } from 'react';

import * as AccordionPrimitive from '@radix-ui/react-accordion';

import { Icons } from '@components/ui/icons';

import { cn } from '@lib/utils';

/**
 * Accordion — full Radix implementation mapped to Civo design tokens.
 *
 * Relies on the `accordion-down` / `accordion-up` keyframes already defined
 * in globals.css (used for the animated height transition on AccordionContent).
 *
 * React 19: uses `React.ComponentRef<>` instead of deprecated `React.ElementRef<>`.
 */

const Accordion = AccordionPrimitive.Root;

const AccordionItem = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border last:border-b-0', className)}
    {...props}
  />
));
AccordionItem.displayName = AccordionPrimitive.Item.displayName;

const AccordionTrigger = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4',
        'text-sm font-medium text-copy transition-all',
        'hover:text-primary-copy',
        // Focus ring uses accent token, consistent with the rest of the system
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        // Chevron rotates 180° when open
        '[&[data-state=open]>svg]:rotate-180',
        className,
      )}
      {...props}
    >
      {children}
      <Icons.chevronDown
        className="size-4 shrink-0 text-copy-muted transition-transform duration-200"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm text-copy-muted',
      // Animated open/close using keyframes from globals.css
      'data-[state=closed]:animate-[accordion-up_200ms_ease-out]',
      'data-[state=open]:animate-[accordion-down_200ms_ease-out]',
    )}
    {...props}
  >
    <div className={cn('pb-4 pt-0', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
