import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@components/ui/breadcrumb';

import { Link } from '@i18n';

/** One step of the trail above a page heading; the last has no address, it is where the person is. */
export interface AdminCrumb {
  readonly label: string;
  readonly href?: string | undefined;
}

interface AdminPageProps {
  readonly children: ReactNode;
}

/**
 * The frame of every admin screen: the shared content column and one vertical rhythm between
 * the heading, notices and panels. Loading skeletons use the same spacing so nothing jumps.
 */
export function AdminPage({ children }: AdminPageProps) {
  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">{children}</Section>
    </AdminContainer>
  );
}

interface AdminPageHeaderProps {
  readonly title: string;
  readonly description?: string | undefined;
  /** Facts about the subject under the lead (an address, a status badge); a detail screen's identity. */
  readonly meta?: ReactNode;
  /** The page's main actions, at the heading's far edge; they wrap below on a narrow screen. */
  readonly actions?: ReactNode;
  /** A way back to wherever the person came from, for a screen with no single parent (the profile). */
  readonly back?: ReactNode;
  /** The way back up; omit on a top-level screen. */
  readonly crumbs?: readonly AdminCrumb[] | undefined;
  /** Accessible name of the breadcrumb landmark; required with `crumbs`. */
  readonly breadcrumbLabel?: string | undefined;
}

/**
 * Heading of an admin screen: optional breadcrumb, the page's single `h1` with its lead, and the
 * main action at the far edge. The heading shrinks instead of pushing the action onto a new line.
 */
export function AdminPageHeader({
  title,
  description,
  meta,
  actions,
  back,
  crumbs,
  breadcrumbLabel,
}: AdminPageHeaderProps) {
  return (
    <div className="space-y-3">
      {back}
      {crumbs !== undefined && crumbs.length > 0 && (
        <Breadcrumb aria-label={breadcrumbLabel}>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={`${String(index)}-${crumb.label}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href === undefined ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
        <div className="min-w-0 flex-1 space-y-2">
          <PageHeading title={title} description={description} />
          {meta}
        </div>
        {actions !== undefined && actions !== null && (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
