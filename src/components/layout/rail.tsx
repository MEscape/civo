import type { ReactNode } from 'react';

import { SECTION_HEADING_CLASS } from '@components/layout/layout-primitives';

import { cn } from '@lib/utils';

export type RailRatio = 'balanced' | 'content-heavy';

/**
 * Rail : body on a 12-column grid. The split follows the container's width
 * (`@4xl` = 56rem), not the viewport's, so it also holds in a narrowed
 * builder canvas. Written out in full so Tailwind finds every class.
 */
const RATIO_CLASSES = {
  balanced: { rail: '@4xl:col-span-5', body: '@4xl:col-span-7' },
  'content-heavy': { rail: '@4xl:col-span-4', body: '@4xl:col-span-8' },
} as const satisfies Record<RailRatio, { readonly rail: string; readonly body: string }>;

const GRID_CLASS = 'grid gap-x-12 gap-y-6 @4xl:grid-cols-12';

export interface RailProps {
  readonly heading: string;
  readonly description?: string | undefined;
  readonly ratio?: RailRatio;
  readonly children: ReactNode;
}

/**
 * A section label beside its content. Stacked in a narrow container (heading
 * first, so reading order and visual order agree), side by side from 56rem.
 * The caller supplies Section and Container; Rail only composes inside them.
 */
export function Rail({ heading, description, ratio = 'content-heavy', children }: RailProps) {
  const columns = RATIO_CLASSES[ratio];

  return (
    <div className="@container">
      <div className={GRID_CLASS}>
        <div className={cn('min-w-0', columns.rail)}>
          <h2 className={cn(SECTION_HEADING_CLASS, 'text-balance')}>{heading}</h2>
          {description !== undefined && (
            <p className="mt-3 max-w-[var(--civo-width-narrow)] text-sm text-copy-muted">
              {description}
            </p>
          )}
        </div>
        <div className={cn('min-w-0', columns.body)}>{children}</div>
      </div>
    </div>
  );
}
