import { Suspense } from 'react';

import type { Metadata } from 'next';

import { DataSourcesSettings } from '@modules/data-sources';
import { GeneralSettingsForm, ThemeSettingsForm, websiteQueries } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { PageSkeleton } from '@components/shared/page-skeleton';

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

async function WebsiteSettingsContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'website' });
  const website = await orFail(websiteQueries.getWebsiteById.execute(websiteId));

  return (
    <AdminContainer>
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
    </AdminContainer>
  );
}

export default function WebsiteSettingsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsiteSettingsContent params={params} />
    </Suspense>
  );
}
