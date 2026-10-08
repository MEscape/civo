import type { Metadata } from 'next';

import { MigrationPanel, releaseQueries } from '@modules/release';
import { toMigrationHistoryDto } from '@modules/release/client';

import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ websiteId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('release');
  return buildPrivateMetadata(t('pages.migrations.title'));
}

export default async function MigrationsPage({ params }: RouteProps) {
  const { websiteId } = await params;
  const t = await getTranslations('release');
  const migrations = await orFail(releaseQueries.listMigrations.execute(websiteId));

  return (
    <Container className="max-w-4xl">
      <Section className="space-y-8">
        <PageHeading
          title={t('pages.migrations.title')}
          description={t('pages.migrations.description')}
        />
        <I18nProvider namespaces={['release']}>
          <MigrationPanel websiteId={websiteId} history={toMigrationHistoryDto(migrations)} />
        </I18nProvider>
      </Section>
    </Container>
  );
}
