import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ServiceDetailAdministration } from '@modules/booking';

import { BookingDetailSkeleton } from '@components/skeletons/booking-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{
    locale: string;
    websiteId: string;
    locationId: string;
    serviceId: string;
  }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('services.title'));
}

async function ServiceDetailContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId, serviceId } = await params;
  const access = await getWebsiteAccess();
  return (
    <ServiceDetailAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      locationId={locationId}
      serviceId={serviceId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function ServiceDetailPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingDetailSkeleton />}>
      <ServiceDetailContent {...props} />
    </Suspense>
  );
}
