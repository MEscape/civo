import type { ReactNode } from 'react';

export interface SplitColumnProps {
  readonly heading: string;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
}

/**
 * One half of the split. Side by side it is a subgrid over the split's rows,
 * so the n-th card of both halves sits in the same row and the two are equally
 * tall; stacked it is a plain column.
 */
export function SplitColumn({ heading, badge, children }: SplitColumnProps) {
  return (
    <div className="flex flex-col gap-4 @3xl:row-span-full @3xl:grid @3xl:grid-rows-subgrid">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">{heading}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}
