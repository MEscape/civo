import type { ReactNode } from 'react';

import { AlertTriangle, ArrowRight } from '@components/ui/icons';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

import { DataPanel } from './data-panel';

export interface OverviewCardProps {
  readonly title: string;
  /** Where the whole subject lives; omitted when the actor may not go there. */
  readonly link?: { readonly href: string; readonly label: string };
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * One block of an overview page: the frame every panel of the admin shares
 * (`DataPanel`), with an optional way to the subject's own page, and the
 * facts as rows. Blocks hold information, not forms, so a page of them reads
 * at a glance.
 */
export function OverviewCard({ title, link, children, className }: OverviewCardProps) {
  return (
    <DataPanel
      title={title}
      className={className}
      actions={
        link !== undefined && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 rounded-token-sm text-xs font-medium text-copy-muted outline-none hover:text-copy focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            {link.label}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )
      }
    >
      <div className="flex flex-col divide-y divide-border">{children}</div>
    </DataPanel>
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
  return <div className={cn('px-4 py-3', className)}>{children}</div>;
}

/** Key figures of an `OverviewCard`, side by side. */
export function OverviewStats({ children }: { readonly children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4">{children}</dl>;
}

export interface OverviewStatProps {
  readonly label: string;
  /** The formatted figure. */
  readonly value: string;
  /** A figure that asks for attention (warnings) is tinted and marked, so colour is not the only signal. */
  readonly tone?: 'default' | 'warning';
}

/** One key figure: a small label over a large number. */
export function OverviewStat({ label, value, tone = 'default' }: OverviewStatProps) {
  const isWarning = tone === 'warning';
  return (
    <div>
      <dt className="text-xs font-medium text-copy-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 flex items-center gap-1.5 font-heading text-2xl font-semibold',
          isWarning ? 'text-warning' : 'text-copy',
        )}
      >
        {isWarning && <AlertTriangle className="size-5" aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}
