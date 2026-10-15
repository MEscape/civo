import { Suspense } from 'react';

import type { Metadata } from 'next';

import {
  HistoryPagination,
  MigrationPanel,
  ReleaseHistoryPanel,
  releaseQueries,
} from '@modules/release';
import { releaseRoutes, toMigrationHistoryDto, toReleaseHistoryDto } from '@modules/release/client';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { LinkTabs } from '@components/shared/link-tabs';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { RefreshOnFocus } from '@components/shared/refresh-on-focus';

import { requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { loadComponentLabels } from '@/app/_lib/component-labels';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
import { loadPublicationStatus } from '@/app/_lib/publication-status';
import { getWebsiteAccess } from '@/app/_lib/website-access';
import type { WebsiteAccess } from '@/app/_lib/website-access';

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<SearchParams>;
}

interface TabProps {
  readonly websiteId: string;
  readonly locale: Locale;
  readonly access: WebsiteAccess;
  readonly searchParams: SearchParams;
}

const TABS = ['releases', 'updates'] as const;
type TabKey = (typeof TABS)[number];

function tabOf(raw: string | string[] | undefined): TabKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return TABS.find((tab) => tab === value) ?? 'releases';
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('pages.releases.title'));
}

async function ReleasesTab({ websiteId, locale, access, searchParams }: TabProps) {
  const { page, pageSize } = searchParams;
  const releases = await orFail(releaseQueries.listReleases.execute(websiteId, { page, pageSize }));
  const authors = await loadMemberNames(releases.items.map((release) => release.publishedBy));

  return (
    <>
      <I18nProvider locale={locale} namespaces={['release']}>
        <ReleaseHistoryPanel
          websiteId={websiteId}
          history={toReleaseHistoryDto(releases)}
          page={releases.page}
          mayRollback={access.may('release.rollback')}
          authors={authors}
        />
      </I18nProvider>
      <HistoryPagination
        locale={locale}
        scope="releases"
        page={releases}
        basePath={releaseRoutes.releases(websiteId)}
      />
    </>
  );
}

async function UpdatesTab({ websiteId, locale, access, searchParams }: TabProps) {
  const { page, pageSize } = searchParams;
  const [migrations, status] = await Promise.all([
    orFail(releaseQueries.listMigrations.execute(websiteId, { page, pageSize })),
    orFail(loadPublicationStatus(websiteId)),
  ]);
  const updates = status.componentUpdates;
  const labels = await loadComponentLabels(
    locale,
    updates?.components.map((component) => component.type) ?? [],
  );

  return (
    <I18nProvider locale={locale} namespaces={['release']}>
      <MigrationPanel
        websiteId={websiteId}
        history={toMigrationHistoryDto(migrations.items)}
        historyTotal={migrations.total}
        updates={updates}
        componentLabels={labels}
        checkedAt={status.checkedAt.toISOString()}
        mayRun={access.may('release.publish')}
      >
        <HistoryPagination
          locale={locale}
          scope="migrations"
          page={migrations}
          basePath={releaseRoutes.releases(websiteId)}
        />
      </MigrationPanel>
    </I18nProvider>
  );
}

async function ReleasesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const query = await searchParams;
  const tab = tabOf(query['tab']);
  const [t, access, status] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getWebsiteAccess(),
    orFail(loadPublicationStatus(websiteId)),
  ]);
  const tabProps = { websiteId, locale, access, searchParams: query };
  const available = status.componentUpdates?.available ?? 0;

  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">
        <RefreshOnFocus />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeading
            title={t('pages.releases.title')}
            description={t('pages.releases.description')}
          />
        </div>

        <LinkTabs
          label={t('pages.releases.tabs.label')}
          activeKey={tab}
          tabs={[
            {
              key: 'releases',
              label: t('pages.releases.tabs.releases'),
              href: releaseRoutes.releases(websiteId),
            },
            {
              key: 'updates',
              label:
                available > 0
                  ? `${t('pages.releases.tabs.updates')} (${available})`
                  : t('pages.releases.tabs.updates'),
              href: releaseRoutes.updates(websiteId),
            },
          ]}
        />

        {tab === 'releases' ? <ReleasesTab {...tabProps} /> : <UpdatesTab {...tabProps} />}
      </Section>
    </AdminContainer>
  );
}

export default function ReleasesPage({ params, searchParams }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReleasesContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
