import type { Metadata } from 'next';

import { builderQueries, CreatePageForm, PageList, toPageSummaryDto } from '@modules/builder';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'builder' });
  return buildPrivateMetadata(t('pages.list.title'));
}

export default async function BuilderPagesPage({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const { websiteId } = await params;
  const t = await getTranslations({ locale, namespace: 'builder' });
  const pages = await orFail(builderQueries.listPages.execute({ websiteId }));

  return (
    <Container className="max-w-4xl">
      <Section className="space-y-8">
        <PageHeading title={t('pages.list.title')} description={t('pages.list.description')} />

        <PageList websiteId={websiteId} pages={pages.map(toPageSummaryDto)} />

        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold text-copy">
            {t('pages.list.createTitle')}
          </h2>
          <I18nProvider locale={locale} namespaces={['builder']}>
            <CreatePageForm websiteId={websiteId} />
          </I18nProvider>
        </div>
      </Section>
    </Container>
  );
}
