import { Suspense } from 'react';

import type { Metadata } from 'next';

import { getAuthQueries, isAuthEnabled } from '@modules/auth';
import { BookingAdministration } from '@modules/booking';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('admin.title'));
}

/**
 * Who a calendar can be assigned to. A person who may not read employees (or a
 * deployment without sign-in, which has no user directory) simply gets none: the
 * assignment field then offers nobody, and the page works as before.
 */
async function listEmployees() {
  if (!isAuthEnabled) {
    return [];
  }
  const employees = await getAuthQueries().listEmployees.execute();
  return employees.isOk() ? employees.value : [];
}

async function WebsiteBookingsContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  const employees = await listEmployees();

  return (
    <AdminContainer>
      <Section className="space-y-8">
        <PageHeading title={t('admin.title')} description={t('admin.description')} />
        <BookingAdministration websiteId={websiteId} employees={employees} locale={locale} />
      </Section>
    </AdminContainer>
  );
}

export default function WebsiteBookingsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsiteBookingsContent params={params} />
    </Suspense>
  );
}
