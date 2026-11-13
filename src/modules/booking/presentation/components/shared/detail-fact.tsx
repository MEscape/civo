import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

const SIZES = {
  /** The admin panels' size. */
  compact: { label: 'text-xs', value: 'text-sm' },
  /** What a visitor reads: 14px labels, 16px values. */
  comfortable: { label: 'text-sm', value: 'text-base' },
} as const;

export interface DetailFactProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly size?: keyof typeof SIZES;
}

/** One labelled fact of a `DetailPanel`, or of a visitor's booking. */
export function DetailFact({ label, children, size = 'compact' }: DetailFactProps) {
  const sizes = SIZES[size];

  return (
    <div className="min-w-0">
      <dt className={cn('font-medium text-copy-muted', sizes.label)}>{label}</dt>
      <dd className={cn('text-copy [overflow-wrap:anywhere]', sizes.value)}>{children}</dd>
    </div>
  );
}
