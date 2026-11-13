import type { ComponentProps, ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';

import { cn } from '@lib/utils';

export interface BookingEmptyStateProps extends Omit<
  ComponentProps<typeof EmptyState>,
  'variant' | 'icon'
> {
  /** What the empty place is about (the calendar, the locations, messages): always drawn, so every empty place has a face. */
  readonly icon: ReactNode;
  /**
   * `panel`: inside a panel or a table, where there is nothing to list. `page`: in place of a whole screen
   * (nothing set up yet), in the dashed outline that marks where content will appear.
   */
  readonly scope?: 'panel' | 'page';
}

/**
 * The one empty state of the booking module: an icon, a title, a sentence that says why and what to do
 * (and the way to do it as a button where there is one), centred, with the same room around it in every
 * list, table and screen. Nothing in the module draws "nothing here" in any other way.
 */
export function BookingEmptyState({
  icon,
  scope = 'panel',
  className,
  ...props
}: BookingEmptyStateProps) {
  return (
    <EmptyState
      icon={icon}
      variant={scope === 'page' ? 'outlined' : 'plain'}
      className={cn(scope === 'page' ? 'p-8' : 'py-10', className)}
      {...props}
    />
  );
}
