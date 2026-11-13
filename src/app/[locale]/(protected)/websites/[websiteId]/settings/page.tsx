import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { WebsiteSettings } from '@modules/website';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { WebsiteSettingsSkeleton } from '@components/skeletons/website-settings-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'website' });
  return buildPrivateMetadata(t('pages.settings.title'));
}

async function SettingsContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getWebsiteAccess(),
  ]);
  if (!access.may('website.update') && !access.may('theme.update')) {
    notFound();
  }
  return (
    <AdminPage>
      <AdminPageHeader
        title={t('pages.settings.title')}
        description={t('pages.settings.description')}
      />
      <WebsiteSettings
        locale={locale}
        websiteId={websiteId}
        canEditGeneral={access.may('website.update')}
        canEditTheme={access.may('theme.update')}
      />
    </AdminPage>
  );
}

export default function SettingsPage(props: RouteProps) {
  return (
    <Suspense fallback={<WebsiteSettingsSkeleton />}>
      <SettingsContent {...props} />
    </Suspense>
  );
}
