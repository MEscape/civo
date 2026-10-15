import { Suspense } from 'react';

import type { Metadata } from 'next';

import { BookingAdministration } from '@modules/booking';
import type { BookingSearchParams } from '@modules/booking';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<BookingSearchParams>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('admin.title'));
}

async function WebsiteBookingsContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading title={t('admin.title')} description={t('admin.description')} />
        <BookingAdministration
          websiteId={websiteId}
          locale={locale}
          searchParams={await searchParams}
        />
      </Section>
    </AdminContainer>
  );
}

export default function WebsiteBookingsPage({ params, searchParams }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsiteBookingsContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
