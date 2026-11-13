import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { InviteUserAdministration, isAuthEnabled } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { InviteUserPageSkeleton } from '@components/skeletons/users-page-skeleton';

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
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('users.invite.title'));
}

async function InviteContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId } = await params;
  // Only hides the page; the invitation command authorizes `user.manage` in this website itself.
  if (!isAuthEnabled || !(await getWebsiteAccess()).may('user.manage')) {
    notFound();
  }
  return (
    <InviteUserAdministration
      locale={requireLocale(locale)}
      scope={{ kind: 'website', websiteId }}
      listHref={websiteRoutes.users(websiteId)}
      searchParams={await searchParams}
    />
  );
}

export default function InvitePage(props: RouteProps) {
  return (
    <Suspense fallback={<InviteUserPageSkeleton />}>
      <InviteContent {...props} />
    </Suspense>
  );
}
