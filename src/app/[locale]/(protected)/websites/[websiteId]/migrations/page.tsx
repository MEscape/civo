import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MigrationPanel, releaseQueries } from '@modules/release';
import { toMigrationHistoryDto } from '@modules/release/client';

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
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('pages.migrations.title'));
}

async function MigrationsContent({ params }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'release' });
  const migrations = await orFail(releaseQueries.listMigrations.execute(websiteId));

  return (
    <AdminContainer>
      <Section className="space-y-8">
        <PageHeading
          title={t('pages.migrations.title')}
          description={t('pages.migrations.description')}
        />
        <I18nProvider locale={locale} namespaces={['release']}>
          <MigrationPanel websiteId={websiteId} history={toMigrationHistoryDto(migrations)} />
        </I18nProvider>
      </Section>
    </AdminContainer>
  );
}

export default function MigrationsPage({ params }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MigrationsContent params={params} />
    </Suspense>
  );
}
