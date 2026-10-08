import type { Metadata } from 'next';

import { DataSourcesSettings } from '@modules/data-sources';
import { ThemeSettingsForm, websiteQueries } from '@modules/website';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ websiteId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('website');
  return buildPrivateMetadata(t('pages.settings.title'));
}

export default async function WebsiteSettingsPage({ params }: RouteProps) {
  const { websiteId } = await params;
  const t = await getTranslations('website');
  const website = await orFail(websiteQueries.getWebsiteById.execute(websiteId));

  return (
    <Container className="max-w-4xl">
      <Section className="space-y-8">
        <PageHeading
          title={t('pages.settings.title')}
          description={t('pages.settings.description')}
        />
        <I18nProvider namespaces={['website', 'dataSources']}>
          <ThemeSettingsForm websiteId={website.id} initialTheme={website.theme} />
          <DataSourcesSettings websiteId={website.id} />
        </I18nProvider>
      </Section>
    </Container>
  );
}
