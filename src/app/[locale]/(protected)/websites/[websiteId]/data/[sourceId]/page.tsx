import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { DataSourceDetailAdministration } from '@modules/data-sources';

import { DataSourceDetailSkeleton } from '@components/skeletons/data-source-detail-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { dataSourceScreen } from '../data-source-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; sourceId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  return buildPrivateMetadata(t('sourceDetail.metaTitle'));
}

async function DataSourceContent({ params }: RouteProps) {
  const { locale, websiteId, sourceId } = await params;
  const access = await getWebsiteAccess();
  if (!access.maySection('data')) {
    notFound();
  }
  const { capabilities, readers, deleteData } = dataSourceScreen(access);
  return (
    <DataSourceDetailAdministration
      locale={requireLocale(locale)}
      websiteId={websiteId}
      sourceId={sourceId}
      capabilities={capabilities}
      readers={readers}
      deleteData={deleteData}
    />
  );
}

export default function DataSourcePage(props: RouteProps) {
  return (
    <Suspense fallback={<DataSourceDetailSkeleton />}>
      <DataSourceContent {...props} />
    </Suspense>
  );
}
