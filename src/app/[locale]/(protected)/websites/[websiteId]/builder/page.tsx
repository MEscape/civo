import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { builderQueries, CreatePageForm, PageList, toPageSummaryDto } from '@modules/builder';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'builder' });
  return buildPrivateMetadata(t('pages.list.title'));
}

async function BuilderPagesContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'builder' });
  const [pages, access] = await Promise.all([
    orFail(builderQueries.listPages.execute({ websiteId })),
    getWebsiteAccess(),
  ]);
  // Every page here opens in the editor.
  if (!access.maySection('builder')) {
    notFound();
  }

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        <PageList websiteId={websiteId} pages={pages.map(toPageSummaryDto)} />

        {access.may('page.create') && (
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-copy">
              {t('pages.list.createTitle')}
            </h2>
            <I18nProvider locale={locale} namespaces={['builder']}>
              <CreatePageForm websiteId={websiteId} />
            </I18nProvider>
          </div>
        )}
      </Section>
    </AdminContainer>
  );
}

export default function BuilderPagesPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BuilderPagesContent params={params} />
    </Suspense>
  );
}
