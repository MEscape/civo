import type { ReactNode } from 'react';

/** Both columns keep the same spacing and list semantics. */
export function SplitList({ children }: { readonly children: ReactNode }) {
  return <ul className="space-y-4">{children}</ul>;
}
