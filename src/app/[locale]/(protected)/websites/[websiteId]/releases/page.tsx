import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ReleaseAdministration } from '@modules/release';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { ReleasesPageSkeleton } from '@components/skeletons/releases-page-skeleton';

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
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('pages.releases.title'));
}

async function ReleasesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getWebsiteAccess(),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.releases.title')}
        description={t('pages.releases.description')}
      />
      <ReleaseAdministration
        locale={locale}
        websiteId={websiteId}
        searchParams={await searchParams}
        mayRollback={access.may('release.rollback')}
        mayRun={access.may('release.publish')}
        mayEditPages={access.maySection('builder')}
      />
    </AdminPage>
  );
}

export default function ReleasesPage(props: RouteProps) {
  return (
    <Suspense fallback={<ReleasesPageSkeleton />}>
      <ReleasesContent {...props} />
    </Suspense>
  );
}
