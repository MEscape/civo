import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { DataSourcesAdministration } from '@modules/data-sources';

import { DataSourcesPageSkeleton } from '@components/skeletons/data-sources-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { dataSourceScreen } from './data-source-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  return buildPrivateMetadata(t('panel.title'));
}

async function DataSourcesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [access, query] = await Promise.all([getWebsiteAccess(), searchParams]);
  if (!access.maySection('data')) {
    notFound();
  }
  const { capabilities, readers, deleteData } = dataSourceScreen(access);
  return (
    <DataSourcesAdministration
      websiteId={websiteId}
      locale={locale}
      searchParams={query}
      capabilities={capabilities}
      readers={readers}
      deleteData={deleteData}
    />
  );
}

export default function DataSourcesPage(props: RouteProps) {
  return (
    <Suspense fallback={<DataSourcesPageSkeleton />}>
      <DataSourcesContent {...props} />
    </Suspense>
  );
}
