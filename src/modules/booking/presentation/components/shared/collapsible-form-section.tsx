import type { ReactNode } from 'react';

import { Icons } from '@components/ui/icons';

import { cn } from '@lib/utils';

export interface CollapsibleFormSectionProps {
  readonly title: string;
  /** What is set, in a few words, so a closed section still tells its state. */
  readonly summary: string;
  readonly description?: string;
  /** A problem lies inside: the section opens by itself, so what is wrong is in view. */
  readonly hasProblem?: boolean;
  readonly children: ReactNode;
}

/**
 * A group of fields that starts closed: the settings most people leave as they
 * are sit behind a line that says what they currently are. A native
 * `<details>`, so it opens with the keyboard and without script. A problem
 * inside opens it and marks the line, so nothing wrong stays hidden.
 */
export function CollapsibleFormSection({
  title,
  summary,
  description,
  hasProblem = false,
  children,
}: CollapsibleFormSectionProps) {
  return (
    <details
      open={hasProblem ? true : undefined}
      className={cn('group rounded-token border', hasProblem ? 'border-danger' : 'border-border')}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-token px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-copy">{title}</span>
        <span
          className={cn(
            'flex items-center gap-2 text-xs',
            hasProblem ? 'font-medium text-danger' : 'text-copy-muted',
          )}
        >
          {summary}
          <Icons.chevronRight
            className="size-4 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {description !== undefined && <p className="text-xs text-copy-muted">{description}</p>}
        {children}
      </div>
    </details>
  );
}
