import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { CreateWebsiteWizard, websiteRoutes } from '@modules/website';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { CreateWebsiteSkeleton } from '@components/skeletons/websites-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.create.title'));
}

async function CreateContent({ params, searchParams }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getWebsiteAccess(),
  ]);
  // Display only: the create command authorizes again.
  if (!access.may('website.create')) {
    notFound();
  }
  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.create.title')}
        description={t('pages.create.description')}
        breadcrumbLabel={t('nav.breadcrumb')}
        crumbs={[
          { label: t('pages.list.title'), href: websiteRoutes.list() },
          { label: t('pages.create.title') },
        ]}
      />
      <CreateWebsiteWizard locale={locale} step={(await searchParams)['step']} />
    </AdminPage>
  );
}

export default function CreateWebsitePage(props: RouteProps) {
  return (
    <Suspense fallback={<CreateWebsiteSkeleton />}>
      <CreateContent {...props} />
    </Suspense>
  );
}
