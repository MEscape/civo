import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { InviteUserAdministration, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { InviteUserPageSkeleton } from '@components/skeletons/users-page-skeleton';

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
  return buildPrivateMetadata(t('users.invite.title'));
}

async function InviteContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);
  // The module reads the websites the viewer manages and answers "not found" to anyone who manages none.
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <InviteUserAdministration
      locale={locale}
      scope={{ kind: 'global' }}
      listHref={websiteRoutes.platformUsers()}
      searchParams={await searchParams}
    />
  );
}

export default function GlobalInvitePage(props: RouteProps) {
  return (
    <Suspense fallback={<InviteUserPageSkeleton />}>
      <InviteContent {...props} />
    </Suspense>
  );
}
