import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { GeneralSettingsForm, ThemeSettingsForm, websiteQueries } from '@modules/website';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { UnsavedChangesGuard } from '@components/shared/unsaved-changes-guard';

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
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.settings.title'));
}

async function WebsiteSettingsContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'website' });
  const [website, access] = await Promise.all([
    orFail(websiteQueries.getWebsiteById.execute(websiteId)),
    getWebsiteAccess(),
  ]);
  // Nothing here is for an actor who may change none of it.
  if (!access.maySection('settings')) {
    notFound();
  }

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading
          title={t('pages.settings.title')}
          description={t('pages.settings.description')}
        />
        <I18nProvider locale={locale} namespaces={['website']}>
          <UnsavedChangesGuard
            title={t('pages.settings.leave.title')}
            description={t('pages.settings.leave.description')}
            confirmLabel={t('pages.settings.leave.confirm')}
            cancelLabel={t('pages.settings.leave.stay')}
          >
            <div className="space-y-6">
              {access.may('website.update') && (
                <GeneralSettingsForm
                  websiteId={website.id}
                  slug={website.slug}
                  initialValues={{ name: website.name, description: website.description ?? '' }}
                />
              )}
              {access.may('theme.update') && (
                <ThemeSettingsForm websiteId={website.id} initialTheme={website.theme} />
              )}
            </div>
          </UnsavedChangesGuard>
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
