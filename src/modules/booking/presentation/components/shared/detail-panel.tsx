import { useId } from 'react';
import type { ReactNode } from 'react';

export interface DetailPanelProps {
  readonly title: string;
  /** A `BookingStatusChip` or the like, above the title. */
  readonly status?: ReactNode;
  /** One quiet line under the title (when and where). */
  readonly subtitle?: string | undefined;
  /** `DetailFact`s. */
  readonly children: ReactNode;
  /** The actions on the thing shown, the main one first. */
  readonly actions?: ReactNode;
}

/**
 * The side panel of a list: what one row is, as labelled facts, with the actions that belong to it.
 * A region named by its title, so a screen-reader user can jump to it.
 */
export function DetailPanel({ title, status, subtitle, children, actions }: DetailPanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-token border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <header className="space-y-1">
        {status}
        <h2 id={headingId} className="font-heading text-lg font-semibold text-copy">
          {title}
        </h2>
        {subtitle !== undefined && <p className="text-sm text-copy-muted">{subtitle}</p>}
      </header>
      <dl className="space-y-3">{children}</dl>
      {actions !== undefined && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
