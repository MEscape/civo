import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { BookingCoverStrip, BookingWorkspaceNav, loadBookingWorkspaces } from '@modules/booking';
import { websiteRoutes } from '@modules/website';

import { SectionBar } from '@components/layout/layout-primitives';
import { SectionBarSkeleton } from '@components/skeletons/section-bar-skeleton';

import { requireLocale } from '@i18n';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface LayoutProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly children: ReactNode;
}

async function WorkspaceBar({ params }: Pick<LayoutProps, 'params'>) {
  const { locale, websiteId } = await params;
  const [workspaces, access] = await Promise.all([loadBookingWorkspaces(), getWebsiteAccess()]);
  if (access.tenantId !== websiteId) {
    notFound();
  }
  const workspace = workspaces.websites.find(({ id }) => id === websiteId);

  return (
    <BookingWorkspaceNav
      locale={requireLocale(locale)}
      websiteId={websiteId}
      websiteName={workspace?.name ?? ''}
      websiteHref={access.maySection('overview') ? websiteRoutes.detail(websiteId) : undefined}
      workspaces={workspaces.websites}
      isWorkspacesTruncated={workspaces.isTruncated}
      may={access.may}
    />
  );
}

/** While the person is sent to another location, every page of the workspace says so under the bar. */
async function CoverStrip({ params }: Pick<LayoutProps, 'params'>) {
  const { locale, websiteId } = await params;
  const access = await getWebsiteAccess();
  // Only an employee has a calendar, so only they can be sent anywhere; nobody else is asked.
  return access.may('booking.profile.own') ? (
    <BookingCoverStrip locale={requireLocale(locale)} websiteId={websiteId} />
  ) : null;
}

/**
 * The booking workspace sits under one bar, like a website does: its name, one tab per area and
 * the way back to the website. It is the same bar in height and behaviour, so moving from the
 * website into its bookings feels like moving between two areas of one product.
 */
export default function BookingWorkspaceLayout({ params, children }: LayoutProps) {
  return (
    <>
      <SectionBar>
        <Suspense fallback={<SectionBarSkeleton hasTrailing />}>
          <WorkspaceBar params={params} />
        </Suspense>
      </SectionBar>
      <Suspense fallback={null}>
        <CoverStrip params={params} />
      </Suspense>
      {children}
    </>
  );
}
