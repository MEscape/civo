import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { builderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { DataSourcesSettings } from '@modules/data-sources';
import type { ComponentAwaitingData, DatasetUse, DatasetUsage } from '@modules/data-sources';
import { releaseQueries } from '@modules/release';
import { deleteUnusedDataAction, releaseRoutes } from '@modules/release/client';

import { AdminContainer, PageHeading, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { PageSkeleton } from '@components/shared/page-skeleton';

import { requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { loadComponentLabels } from '@/app/_lib/component-labels';
import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'dataSources' });
  return buildPrivateMetadata(t('panel.title'));
}

/** Which pages show each dataset; `null` for someone who may not read pages or when the read fails. */
/**
 * Which pages show each dataset: the saved drafts, each component linking to
 * the editor, and the live site, linking to publishing. `null` for someone
 * who may not read pages, or when a read fails, so "unused" is never guessed.
 * Also the components still showing sample data, where new data goes next.
 */
async function loadDatasetUsage(
  websiteId: string,
  locale: Locale,
  mayReadPages: boolean,
): Promise<{ readonly usage: DatasetUsage; readonly awaiting: readonly ComponentAwaitingData[] }> {
  const none = { usage: null, awaiting: [] };
  if (!mayReadPages) {
    return none;
  }
  const [drafts, live] = await Promise.all([
    builderQueries.listDatasetUsage.execute(websiteId),
    releaseQueries.listLiveDatasetUsage.execute(websiteId),
  ]);
  if (drafts.isErr() || live.isErr()) {
    return none;
  }
  const { byDataset, awaiting } = drafts.value;
  const types = [
    ...Object.values(byDataset).flatMap((pages) =>
      pages.flatMap((page) => page.components.map((component) => component.type)),
    ),
    ...awaiting.map((component) => component.type),
  ];
  const labels = await loadComponentLabels(locale, [...new Set(types)]);
  const usage: Record<string, DatasetUse[]> = {};
  for (const [datasetId, pages] of Object.entries(byDataset)) {
    usage[datasetId] = pages.map((page) => ({
      title: page.title,
      href: builderRoutes.editor(websiteId, page.pageId),
      isLive: false,
      components: page.components.map((component) => ({
        label: labels[component.type] ?? component.type,
        href: builderRoutes.component(websiteId, page.pageId, component.nodeId),
      })),
    }));
  }
  for (const [datasetId, pages] of Object.entries(live.value)) {
    (usage[datasetId] ??= []).push(
      ...pages.map((page) => ({
        title: page.title,
        href: releaseRoutes.releases(websiteId),
        isLive: true,
        components: [],
      })),
    );
  }
  return {
    usage,
    awaiting: awaiting.map((component) => ({
      label: labels[component.type] ?? component.type,
      page: component.title,
      kind: component.kind,
      href: builderRoutes.component(websiteId, component.pageId, component.nodeId),
    })),
  };
}

async function DataSourcesContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId } = await params;
  const locale = requireLocale(rawLocale);
  const [t, access, { page, pageSize }] = await Promise.all([
    getTranslations({ locale, namespace: 'dataSources' }),
    getWebsiteAccess(),
    searchParams,
  ]);
  if (!access.maySection('data')) {
    notFound();
  }
  const { usage, awaiting } = await loadDatasetUsage(
    websiteId,
    locale,
    access.may('page.read') && access.may('release.read'),
  );

  return (
    <AdminContainer>
      <Section className="space-y-8 py-8">
        <PageHeading title={t('panel.title')} description={t('panel.intro')} />
        <I18nProvider locale={locale} namespaces={['dataSources']}>
          <DataSourcesSettings
            websiteId={websiteId}
            locale={locale}
            page={page}
            pageSize={pageSize}
            usage={usage}
            deleteData={deleteUnusedDataAction}
            awaiting={awaiting}
          />
        </I18nProvider>
      </Section>
    </AdminContainer>
  );
}

export default function DataSourcesPage(props: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DataSourcesContent {...props} />
    </Suspense>
  );
}
