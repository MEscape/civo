import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { UsersAdministration, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { UsersPageSkeleton } from '@components/skeletons/users-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('users.metadata.title'));
}

async function UsersContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);

  // Users live in the authentication store, which only exists while sign-in does.
  if (!isAuthEnabled) {
    notFound();
  }

  return (
    <UsersAdministration
      locale={locale}
      pathname={websiteRoutes.users(websiteId)}
      scope={{ kind: 'website', websiteId, globalUsersHref: websiteRoutes.platformUsers() }}
      searchParams={await searchParams}
    />
  );
}

export default function UsersPage(props: RouteProps) {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <UsersContent {...props} />
    </Suspense>
  );
}
