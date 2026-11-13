import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { BookingOverviewAdministration, bookingRoutes } from '@modules/booking';

import { BookingOverviewSkeleton } from '@components/skeletons/booking-screens-skeleton';

import { redirect, requireLocale } from '@i18n';

import { getWebsiteAccess } from '@/app/_lib/website-access';

export const metadata: Metadata = { robots: { index: false } };

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

/** The bookings section opens on the workspace overview for managers and on their own area for employees. */
async function BookingsEntry({ params }: RouteProps) {
  const { locale, websiteId } = await params;
  const access = await getWebsiteAccess();
  if (access.may('booking.read')) {
    return (
      <BookingOverviewAdministration
        locale={requireLocale(locale)}
        websiteId={websiteId}
        may={access.may}
      />
    );
  }
  // Someone who sees only their own bookings (an employee) has their own area and no other.
  if (access.may('booking.read.own')) {
    return redirect({ href: bookingRoutes.me(websiteId), locale: requireLocale(locale) });
  }
  notFound();
}

export default function WebsiteBookingsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<BookingOverviewSkeleton />}>
      <BookingsEntry params={params} />
    </Suspense>
  );
}
