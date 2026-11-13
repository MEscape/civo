import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ServicesAdministration } from '@modules/booking';

import { BookingServicesSkeleton } from '@components/skeletons/booking-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; locationId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('services.title'));
}

async function ServicesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId } = await params;
  const access = await getWebsiteAccess();
  return (
    <ServicesAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      locationId={locationId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function ServicesPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingServicesSkeleton />}>
      <ServicesContent {...props} />
    </Suspense>
  );
}
