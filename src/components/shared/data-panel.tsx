import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

export interface DataPanelProps {
  readonly title: string;
  readonly description?: string;
  /** Controls that act on the whole panel: a refresh, the one main action. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  /** A quiet line under the content: a count, a hint. */
  readonly footer?: ReactNode;
  readonly className?: string;
}

/**
 * The frame of a list or table that is the subject of a screen: a tinted
 * header strip with the title and what acts on the whole list, the rows, and
 * an optional footer. Lists of one screen look alike because they share it.
 */
export function DataPanel({
  title,
  description,
  actions,
  children,
  footer,
  className,
}: DataPanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-token border border-border bg-surface shadow-sm',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-copy">{title}</h2>
          {description !== undefined && <p className="text-xs text-copy-muted">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
      {footer !== undefined && (
        <footer className="border-t border-border bg-canvas px-4 py-2 text-xs text-copy-muted">
          {footer}
        </footer>
      )}
    </section>
  );
}
