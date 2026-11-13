import { Suspense } from 'react';

import type { Metadata } from 'next';

import { OwnProfileAdministration } from '@modules/booking';

import { BookingProfileSkeleton } from '@components/skeletons/employee-screens-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'booking' });
  return buildPrivateMetadata(t('team.profile.title'));
}

async function OwnProfileContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  return <OwnProfileAdministration locale={requireLocale(rawLocale)} websiteId={websiteId} />;
}

export default function OwnProfilePage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingProfileSkeleton />}>
      <OwnProfileContent {...props} />
    </Suspense>
  );
}
