import { Suspense } from 'react';

import type { Metadata } from 'next';

import { CalendarAdministration } from '@modules/booking';

import { BookingCalendarSkeleton } from '@components/skeletons/booking-screens-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('calendar.title'));
}

async function CalendarContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <CalendarAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function CalendarPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingCalendarSkeleton />}>
      <CalendarContent {...props} />
    </Suspense>
  );
}
