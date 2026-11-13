import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

import { sectionDensityClass, sectionToneClass } from '@components/layout/layout-primitives';
import type { SectionDensity, SectionTone } from '@components/layout/layout-primitives';

import { cn } from '@lib/utils';

export interface SectionBlockProps {
  readonly tone: SectionTone;
  /** How much vertical room the sections inside take; they all follow it. */
  readonly density?: SectionDensity;
  readonly layout?: 'stack' | 'split' | 'aside';
  readonly children: ReactNode;
}

/**
 * Groups child components under one background. It adds no padding of its
 * own: the children are sections that already space themselves, and a
 * second layer would double the gap. Density works through a CSS variable
 * the children's `py-section` reads, so it needs no prop on any block.
 */
export function SectionBlock({
  tone,
  density = 'default',
  layout = 'stack',
  children,
}: SectionBlockProps) {
  return (
    <div className={cn('w-full', sectionToneClass(tone), sectionDensityClass(density))}>
      {layout === 'stack' ? (
        children
      ) : (
        <div className="@container mx-auto max-w-7xl">
          <div
            className={cn(
              'grid min-w-0 grid-cols-1 @4xl:grid-cols-2',
              layout === 'aside' && '@4xl:grid-cols-3',
            )}
          >
            {Children.toArray(children).map((child, index) => (
              <div
                key={isValidElement(child) ? child.key : undefined}
                className={cn('min-w-0', layout === 'aside' && index === 0 && '@4xl:col-span-2')}
              >
                {child}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
