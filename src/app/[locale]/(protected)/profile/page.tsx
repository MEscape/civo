import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ProfileAdministration } from '@modules/auth';

import { ProfilePageSkeleton } from '@components/skeletons/profile-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('profile.title'));
}

async function ProfileContent({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  return <ProfileAdministration locale={locale} />;
}

export default function ProfilePage(props: RouteProps) {
  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <ProfileContent {...props} />
    </Suspense>
  );
}
