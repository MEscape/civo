import type { Metadata } from 'next';

import { MigrationPanel, releaseQueries } from '@modules/release';
import { toMigrationHistoryDto } from '@modules/release/client';

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
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('pages.migrations.title'));
}

export default async function MigrationsPage({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const { websiteId } = await params;
  const t = await getTranslations({ locale, namespace: 'release' });
  const migrations = await orFail(releaseQueries.listMigrations.execute(websiteId));

  return (
    <Container className="max-w-4xl">
      <Section className="space-y-8">
        <PageHeading
          title={t('pages.migrations.title')}
          description={t('pages.migrations.description')}
        />
        <I18nProvider locale={locale} namespaces={['release']}>
          <MigrationPanel websiteId={websiteId} history={toMigrationHistoryDto(migrations)} />
        </I18nProvider>
      </Section>
    </Container>
  );
}
