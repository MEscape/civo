import type { ReactNode } from 'react';

export interface SplitListProps {
  readonly children: ReactNode;
}

/** The cards of one half of the split: one row of the split's grid per card. */
export function SplitList({ children }: SplitListProps) {
  return (
    <ul className="flex flex-col gap-4 @3xl:row-[2/-1] @3xl:grid @3xl:grid-rows-subgrid">
      {children}
    </ul>
  );
}
