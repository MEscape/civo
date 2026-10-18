import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { builderQueries, CreatePageForm, PageList, toPageListItemDto } from '@modules/builder';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { DataPanel } from '@components/shared/data-panel';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';
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
  const { page, pageSize } = await searchParams;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'builder' });
  const [pages, access] = await Promise.all([
    orFail(builderQueries.listPages.execute({ websiteId, page, pageSize })),
    getWebsiteAccess(),
  ]);
  // Every page here opens in the editor.
  if (!access.maySection('builder')) {
    notFound();
  }

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <RefreshOnFocus />
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        <PageList
          locale={locale}
          websiteId={websiteId}
          pages={{ ...pages, items: pages.items.map(toPageListItemDto) }}
        />

        {access.may('page.create') && (
          <DataPanel title={t('pages.list.createTitle')}>
            <I18nProvider locale={locale} namespaces={['builder']}>
              <CreatePageForm websiteId={websiteId} />
            </I18nProvider>
          </DataPanel>
        )}
      </Section>
    </AdminContainer>
  );
}

export default function BuilderPagesPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuilderPagesContent {...props} />
    </Suspense>
  );
}
