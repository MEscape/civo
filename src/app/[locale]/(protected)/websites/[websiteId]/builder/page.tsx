import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { BuilderPagesAdministration, builderRoutes } from '@modules/builder';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { BuilderPagesSkeleton } from '@components/skeletons/builder-pages-skeleton';
import { buttonVariants } from '@components/ui/button';

import { Link, requireLocale } from '@i18n';

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
  return buildPrivateMetadata(t('pages.list.title'));
}

async function BuilderPagesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'builder' }),
    getWebsiteAccess(),
  ]);
  // Every page here opens in the editor.
  if (!access.maySection('builder')) {
    notFound();
  }

  const canCreate = access.may('page.create');

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.list.title')}
        description={t('pages.list.description')}
        actions={
          canCreate && (
            <Link href={builderRoutes.create(websiteId)} className={buttonVariants()}>
              {t('pages.list.createTitle')}
            </Link>
          )
        }
      />
      <BuilderPagesAdministration
        locale={locale}
        websiteId={websiteId}
        pathname={builderRoutes.pages(websiteId)}
        searchParams={await searchParams}
        canCreate={canCreate}
      />
    </AdminPage>
  );
}

export default function BuilderPagesPage(props: RouteProps) {
  return (
    <Suspense fallback={<BuilderPagesSkeleton />}>
      <BuilderPagesContent {...props} />
    </Suspense>
  );
}
