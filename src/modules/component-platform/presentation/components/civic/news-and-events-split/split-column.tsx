import type { ReactNode } from 'react';

interface SplitColumnProps {
  readonly heading: string;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
}

/** A column's heading and source status stay with its content at every width. */
export function SplitColumn({ heading, badge, children }: SplitColumnProps) {
  return (
    <div className="min-w-0 space-y-4">
      <h3 className="border-b border-border pb-3 font-heading text-xl font-semibold text-copy">
        {heading}
      </h3>
      {badge}
      {children}
    </div>
  );
}
