import { Suspense } from 'react';

import type { Metadata } from 'next';

import { LocationsAdministration } from '@modules/booking';

import { BookingLocationsSkeleton } from '@components/skeletons/booking-screens-skeleton';

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
  return buildPrivateMetadata(t('locations.title'));
}

async function LocationsContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <LocationsAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function LocationsPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingLocationsSkeleton />}>
      <LocationsContent {...props} />
    </Suspense>
  );
}
