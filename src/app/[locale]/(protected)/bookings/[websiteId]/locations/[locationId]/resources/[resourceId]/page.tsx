import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ResourceDetailAdministration } from '@modules/booking';

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
    resourceId: string;
  }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('resources.title'));
}

async function ResourceDetailContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId, resourceId } = await params;
  const access = await getWebsiteAccess();
  return (
    <ResourceDetailAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      locationId={locationId}
      resourceId={resourceId}
      searchParams={await searchParams}
      may={access.may}
    />
  );
}

export default function ResourceDetailPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingDetailSkeleton isResource />}>
      <ResourceDetailContent {...props} />
    </Suspense>
  );
}
