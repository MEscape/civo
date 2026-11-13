import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { builderRoutes, CreatePageWizard } from '@modules/builder';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { CreatePageSkeleton } from '@components/skeletons/builder-pages-skeleton';

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
  const t = await getTranslations({ locale, namespace: 'builder' });
  return buildPrivateMetadata(t('pages.create.title'));
}

async function CreateContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'builder' }),
    getWebsiteAccess(),
  ]);
  // Display only: the create command authorizes again.
  if (!access.may('page.create')) {
    notFound();
  }
  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.create.title')}
        description={t('pages.create.description')}
        breadcrumbLabel={t('pages.create.breadcrumb')}
        crumbs={[
          { label: t('pages.list.title'), href: builderRoutes.pages(websiteId) },
          { label: t('pages.create.title') },
        ]}
      />
      <CreatePageWizard locale={locale} websiteId={websiteId} step={(await searchParams)['step']} />
    </AdminPage>
  );
}

export default function CreatePagePage(props: RouteProps) {
  return (
    <Suspense fallback={<CreatePageSkeleton />}>
      <CreateContent {...props} />
    </Suspense>
  );
}
