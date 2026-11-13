import { Suspense } from 'react';

import type { Metadata } from 'next';

import { PreferencesAdministration } from '@modules/booking';

import { BookingPreferencesSkeleton } from '@components/skeletons/employee-screens-skeleton';

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
  return buildPrivateMetadata(t('employee.preferences.title'));
}

async function PreferencesContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const access = await getWebsiteAccess();
  return (
    <PreferencesAdministration
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      may={access.may}
    />
  );
}

export default function PreferencesPage(props: RouteProps) {
  return (
    <Suspense fallback={<BookingPreferencesSkeleton />}>
      <PreferencesContent {...props} />
    </Suspense>
  );
}
