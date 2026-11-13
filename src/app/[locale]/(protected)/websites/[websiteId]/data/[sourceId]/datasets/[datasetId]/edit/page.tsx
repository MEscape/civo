import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { DatasetFormAdministration } from '@modules/data-sources';

import { DataSourceFormSkeleton } from '@components/skeletons/data-source-form-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{
    locale: string;
    websiteId: string;
    sourceId: string;
    datasetId: string;
  }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  return buildPrivateMetadata(t('datasetForm.titleEdit'));
}

async function FormContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId, sourceId, datasetId } = await params;
  const access = await getWebsiteAccess();
  if (!access.may('dataset.update')) {
    notFound();
  }
  return (
    <DatasetFormAdministration
      locale={requireLocale(locale)}
      websiteId={websiteId}
      sourceId={sourceId}
      datasetId={datasetId}
      step={(await searchParams)['step']}
    />
  );
}

export default function FormPage(props: RouteProps) {
  return (
    <Suspense fallback={<DataSourceFormSkeleton />}>
      <FormContent {...props} />
    </Suspense>
  );
}
