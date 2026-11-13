import { Suspense } from 'react';

import { BookingWorkspaces, loadBookingWorkspaces } from '@modules/booking';

import { BookingCardsSkeleton } from '@components/skeletons/booking-page-skeleton';

import { requireLocale } from '@i18n';

export const metadata = { robots: { index: false } };

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
}

async function WorkspacesContent({ params }: RouteProps) {
  const { locale } = await params;
  const { websites, isTruncated } = await loadBookingWorkspaces();
  return (
    <BookingWorkspaces
      locale={requireLocale(locale)}
      websites={websites}
      isTruncated={isTruncated}
    />
  );
}

export default function BookingWorkspacesPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingCardsSkeleton />}>
      <WorkspacesContent {...props} />
    </Suspense>
  );
}
