import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ResourceFormAdministration } from '@modules/booking';

import { BookingFormPageSkeleton } from '@components/skeletons/booking-form-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

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

async function ResourceFormContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId, resourceId } = await params;
  return (
    <ResourceFormAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      locationId={locationId}
      resourceId={resourceId}
      searchParams={await searchParams}
    />
  );
}

export default function ResourceFormPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingFormPageSkeleton steps={0} />}>
      <ResourceFormContent {...props} />
    </Suspense>
  );
}
