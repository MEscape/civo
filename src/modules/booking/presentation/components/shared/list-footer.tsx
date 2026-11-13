import type { ReactNode } from 'react';

export interface ListFooterProps {
  /** What the list's states mean ("active", "inactive"), in the strip under the rows, not as a banner of its own. */
  readonly legend?: { readonly title: string; readonly body: string };
  /** The pagination, when there is more than one page. */
  readonly children?: ReactNode;
}

/**
 * The strip under a list's rows: a short explanation on the left, the pages on the right. A list
 * with neither has no strip at all (`DataPanel`'s `footer` stays unset), so nothing empty is drawn.
 */
export function ListFooter({ legend, children }: ListFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {legend !== undefined && (
        <p className="max-w-prose">
          <span className="font-medium text-copy">{`${legend.title}. `}</span>
          {legend.body}
        </p>
      )}
      {children}
    </div>
  );
}
