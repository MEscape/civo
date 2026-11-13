import { Suspense } from 'react';

import type { Metadata } from 'next';

import { bookingRoutes } from '@modules/booking';

import { BookingPageSkeleton } from '@components/skeletons/booking-page-skeleton';

import { redirect, requireLocale } from '@i18n';

export const metadata: Metadata = { robots: { index: false } };

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; bookingPath?: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The query as it came, every repeated value kept. */
function queryOf(raw: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, values] of Object.entries(raw)) {
    for (const value of [values ?? []].flat()) {
      query.append(key, value);
    }
  }
  return query.size === 0 ? '' : `?${query.toString()}`;
}

/** Preserve saved links and wizard/list state while booking moves to its standalone workspace. */
async function LegacyBookingContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId, bookingPath = [] } = await params;
  const path = bookingPath.map((part) => `/${encodeURIComponent(part)}`).join('');
  return redirect({
    href: `${bookingRoutes.admin(encodeURIComponent(websiteId))}${path}${queryOf(await searchParams)}`,
    locale: requireLocale(locale),
  });
}

export default function LegacyBookingPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingPageSkeleton />}>
      <LegacyBookingContent {...props} />
    </Suspense>
  );
}
