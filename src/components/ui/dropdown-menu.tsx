'use client';

import type { ComponentProps } from 'react';

import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';

import { cn } from '@lib/utils';

import { usePortalContainer } from './portal-container';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-56 max-w-[calc(100vw-2rem)] rounded-token border border-border bg-surface p-1 text-copy shadow-lg outline-none',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-default items-center gap-2 rounded-token-sm px-3 py-2 text-sm outline-none focus:bg-canvas data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-3 py-2 text-sm', className)} {...props} />;
}

export function DropdownMenuSeparator(props: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className="my-1 h-px bg-border" {...props} />;
}
