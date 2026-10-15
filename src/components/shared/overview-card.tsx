import type { ReactNode } from 'react';

import { ArrowRight } from '@components/ui/icons';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface OverviewCardProps {
  readonly title: string;
  /** Where the whole subject lives; omitted when the actor may not go there. */
  readonly link?: { readonly href: string; readonly label: string };
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * One block of an overview page: a quiet title, an optional way to the
 * subject's own page, and the facts. Blocks hold information, not forms, so
 * a page of them reads at a glance.
 */
export function OverviewCard({ title, link, children, className }: OverviewCardProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-token border border-border bg-surface text-copy shadow-sm',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-copy">{title}</h2>
        {link !== undefined && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 rounded-token-sm text-xs font-medium text-copy-muted outline-none hover:text-copy focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {link.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="flex flex-1 flex-col divide-y divide-border">{children}</div>
    </section>
  );
}

/** One row of an `OverviewCard`: a label above or beside its value. */
export function OverviewRow({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <div className={cn('px-5 py-3', className)}>{children}</div>;
}
