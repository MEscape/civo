import type { Metadata } from 'next';

import { builderQueries, CreatePageForm, PageList, toPageSummaryDto } from '@modules/builder';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ websiteId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('builder');
  return buildPrivateMetadata(t('pages.list.title'));
}

export default async function BuilderPagesPage({ params }: RouteProps) {
  const { websiteId } = await params;
  const t = await getTranslations('builder');
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
          <I18nProvider namespaces={['builder']}>
            <CreatePageForm websiteId={websiteId} />
          </I18nProvider>
        </div>
      </Section>
    </Container>
  );
}
