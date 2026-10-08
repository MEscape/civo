import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

import type { Viewport } from '../../state/ui-state';

const VIEWPORT_CLASS = {
  desktop: 'max-w-full',
  tablet: 'max-w-3xl',
  mobile: 'max-w-sm',
} as const satisfies Record<Viewport, string>;

export interface ViewportFrameProps {
  readonly viewport: Viewport;
  readonly children: ReactNode;
}

/** The width-constrained frame shared by the editing canvas and the preview. */
export function ViewportFrame({ viewport, children }: ViewportFrameProps) {
  return (
    <div
      className={cn(
        'mx-auto transition-[max-width] duration-150 motion-reduce:transition-none',
        VIEWPORT_CLASS[viewport],
      )}
    >
      {children}
    </div>
  );
}
