import { Suspense } from 'react';

import type { Metadata } from 'next';

import { TeamMemberAdministration } from '@modules/booking';

import { BookingProfileSkeleton } from '@components/skeletons/employee-screens-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{
    locale: string;
    websiteId: string;
    locationId: string;
    employeeId: string;
  }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('team.title'));
}

async function TeamMemberContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId, locationId, employeeId } = await params;
  return (
    <TeamMemberAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      locationId={locationId}
      employeeId={employeeId}
    />
  );
}

export default function TeamMemberPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingProfileSkeleton isManager />}>
      <TeamMemberContent {...props} />
    </Suspense>
  );
}
