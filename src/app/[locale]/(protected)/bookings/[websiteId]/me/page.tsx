import { Suspense } from 'react';

import type { Metadata } from 'next';

import { EmployeeStartAdministration } from '@modules/booking';

import { BookingStartSkeleton } from '@components/skeletons/employee-screens-skeleton';

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
  return buildPrivateMetadata(t('employee.start.title'));
}

async function EmployeeStartContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <EmployeeStartAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      may={access.may}
    />
  );
}

export default function EmployeeStartPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingStartSkeleton />}>
      <EmployeeStartContent {...props} />
    </Suspense>
  );
}
