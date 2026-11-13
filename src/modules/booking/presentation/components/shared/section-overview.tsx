import type { ReactNode } from 'react';

import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface SectionOverviewRow {
  readonly key: string;
  readonly title: string;
  /** What is set today, worked out from the data, never typed. */
  readonly summary: ReactNode;
  /**
   * How the part is edited; absent for someone who may only look. An address, or a handler for a
   * part that is edited on the same page (a wizard's review step), where a link would ask whether
   * to discard unsaved work.
   */
  readonly action?:
    | { readonly label: string; readonly href: string }
    | { readonly label: string; readonly onSelect: () => void }
    | undefined;
}

export interface SectionOverviewProps {
  /** What the rows are the parts of; the list's accessible name. */
  readonly label: string;
  readonly rows: readonly SectionOverviewRow[];
}

/**
 * The parts of a thing as rows: each with what is set today and its own way in, so a person changes
 * one part without walking through the others. Used by every edit overview (locations, services,
 * resources) and by the review step of a wizard.
 */
export function SectionOverview({ label, rows }: SectionOverviewProps) {
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y divide-border overflow-hidden rounded-token border border-border bg-surface shadow-sm"
    >
      {rows.map(({ key, title, summary, action }) => (
        <li
          key={key}
          // `flex-1`: beside a taller neighbour (a map) the rows share the height instead of leaving a gap.
          className="flex flex-1 flex-col justify-center gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div className="min-w-0 sm:flex sm:flex-1 sm:gap-6">
            <h2 className="text-sm font-semibold text-copy sm:w-40 sm:shrink-0">{title}</h2>
            <div className="min-w-0 text-sm text-copy-muted [overflow-wrap:anywhere]">
              {summary}
            </div>
          </div>
          {action !== undefined &&
            ('href' in action ? (
              <Link
                href={action.href}
                aria-label={`${action.label}: ${title}`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'self-start sm:self-center',
                )}
              >
                {action.label}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${action.label}: ${title}`}
                className="self-start sm:self-center"
                onClick={action.onSelect}
              >
                {action.label}
              </Button>
            ))}
        </li>
      ))}
    </ul>
  );
}
