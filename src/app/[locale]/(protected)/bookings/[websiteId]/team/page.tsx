import { Suspense } from 'react';

import type { Metadata } from 'next';

import { LocationEntryAdministration } from '@modules/booking';

import { BookingAreaSkeleton } from '@components/skeletons/booking-area-skeleton';

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
  return buildPrivateMetadata(t('team.title'));
}

async function LocationEntryContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <LocationEntryAdministration
      area="team"
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function LocationEntryPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingAreaSkeleton />}>
      <LocationEntryContent {...props} />
    </Suspense>
  );
}
