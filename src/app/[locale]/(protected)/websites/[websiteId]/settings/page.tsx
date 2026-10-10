import type { Metadata } from 'next';

import { DataSourcesSettings } from '@modules/data-sources';
import { GeneralSettingsForm, ThemeSettingsForm, websiteQueries } from '@modules/website';

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
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.settings.title'));
}

export default async function WebsiteSettingsPage({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const { websiteId } = await params;
  const t = await getTranslations({ locale, namespace: 'website' });
  const website = await orFail(websiteQueries.getWebsiteById.execute(websiteId));

  return (
    <Container className="max-w-5xl">
      <Section className="space-y-10">
        <PageHeading
          title={t('pages.settings.title')}
          description={t('pages.settings.description')}
        />
        <I18nProvider locale={locale} namespaces={['website', 'dataSources']}>
          <GeneralSettingsForm
            websiteId={website.id}
            slug={website.slug}
            initialValues={{ name: website.name, description: website.description ?? '' }}
          />
          <ThemeSettingsForm websiteId={website.id} initialTheme={website.theme} />
          <DataSourcesSettings websiteId={website.id} />
        </I18nProvider>
      </Section>
    </Container>
  );
}
