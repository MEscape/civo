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
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('users.global.metadata.title'));
}

async function GlobalUsersContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);

  // Accounts live in the authentication store; the shared queries authorize the viewer and constrain every listed website.
  if (!isAuthEnabled) {
    notFound();
  }

  return (
    <UsersAdministration
      locale={locale}
      pathname={websiteRoutes.platformUsers()}
      scope={{ kind: 'global', websiteUsersHref: websiteRoutes.users }}
      searchParams={await searchParams}
    />
  );
}

export default function GlobalUsersPage(props: RouteProps) {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <GlobalUsersContent {...props} />
    </Suspense>
  );
}
