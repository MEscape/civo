import type { ReactNode } from 'react';

import { AdminContainer, Section } from '@components/layout/layout-primitives';
import { LoadingStatus } from '@components/shared/page-parts.client';
import { Skeleton } from '@components/ui/skeleton';

import { cn } from '@lib/utils';

const PANEL = 'overflow-hidden rounded-token border border-border bg-surface shadow-sm';
const STRIP = 'flex items-center justify-between gap-3 bg-canvas px-4 py-3';

interface AdminPageSkeletonProps {
  /** A breadcrumb above the heading (a detail or form screen). */
  readonly hasCrumbs?: boolean;
  /** A main action at the heading's far edge. */
  readonly hasAction?: boolean;
  readonly children: ReactNode;
}

/**
 * The placeholder of an `AdminPage` with its `AdminPageHeader`: the same column, rhythm and
 * heading shape, so the content replaces it without a jump. Children are the page's panels.
 */
export function AdminPageSkeleton({
  hasCrumbs = false,
  hasAction = false,
  children,
}: AdminPageSkeletonProps) {
  return (
    <AdminContainer aria-busy="true">
      <Section className="space-y-6 py-8">
        <LoadingStatus />
        <div aria-hidden="true" className="space-y-6">
          <div className="space-y-3">
            {hasCrumbs && <Skeleton className="h-4 w-40" />}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              {hasAction && <Skeleton className="h-8 w-36 shrink-0" />}
            </div>
          </div>
          {children}
        </div>
      </Section>
    </AdminContainer>
  );
}

interface DataPanelSkeletonProps {
  readonly rows?: number;
  /** A filter strip under the header (search, selects, quick filters). */
  readonly hasToolbar?: boolean;
  /** A pagination strip under the rows. */
  readonly hasFooter?: boolean;
  readonly className?: string | undefined;
}

/** The placeholder of a `DataPanel` around a `ResponsiveTable`: header strip, optional filters, rows. */
export function DataPanelSkeleton({
  rows = 5,
  hasToolbar = false,
  hasFooter = false,
  className,
}: DataPanelSkeletonProps) {
  return (
    <div className={cn(PANEL, className)}>
      <div className={cn(STRIP, 'border-b border-border')}>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      {hasToolbar && (
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <Skeleton className="h-9 min-w-48 flex-1" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid gap-3 p-4 sm:grid-cols-4 sm:items-center">
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24 sm:justify-self-end" />
          </div>
        ))}
      </div>
      {hasFooter && (
        <div className={cn(STRIP, 'border-t border-border')}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-40" />
        </div>
      )}
    </div>
  );
}

/** The placeholder of a form in a `DataPanel`: header strip, fields, and the footer with its button. */
export function FormPanelSkeleton({
  fields = 3,
  className,
}: {
  readonly fields?: number;
  readonly className?: string | undefined;
}) {
  return (
    <div className={cn(PANEL, className)}>
      <div className={cn(STRIP, 'border-b border-border')}>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        {Array.from({ length: fields }, (_, field) => (
          <div key={field} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className={cn(STRIP, 'justify-end border-t border-border')}>
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  );
}

/** The placeholder of a `Wizard`: the step indicator above a form panel. */
export function WizardSkeleton({
  steps = 3,
  fields = 3,
}: {
  readonly steps?: number;
  readonly fields?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {Array.from({ length: steps }, (_, step) => (
          <div key={step} className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            {/* Shrinks with the row: four steps must fit a phone and a half-width column alike. */}
            <Skeleton className="h-4 min-w-0 max-w-20 flex-1" />
          </div>
        ))}
      </div>
      <FormPanelSkeleton fields={fields} />
    </div>
  );
}
