import { cache, Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  BuilderSessionProvider,
  BuilderShell,
  BuilderSkeleton,
  builderQueries,
  collectCategoryTypes,
  collectDatasetTypes,
  toDatasetOptionsByType,
  toEditorSessionDto,
} from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { componentPlatformQueries } from '@modules/component-platform';
import { dataSourceQueries } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { themeToCssVariables } from '@modules/website';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { assertNever } from '@lib/utils';

import { loadWebsite } from '@/app/_lib/load-website';
import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; pageId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Deduplicates the load between `generateMetadata` and the page within one request. */
const loadSession = cache((pageId: string) => builderQueries.getEditorSession.execute(pageId));

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const { pageId } = await params;
  const t = await getTranslations({ locale, namespace: 'builder' });
  const result = await loadSession(pageId);
  return {
    title: result.match(
      (session) => t('metadata.title', { pageTitle: session.page.title }),
      () => t('metadata.fallbackTitle'),
    ),
    robots: { index: false },
  };
}

/**
 * The editor's Client Components read `builder` text and, through `useComponentText`,
 * the platform components' labels (`componentPlatform`); only this subtree receives them.
 */
async function BuilderContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, pageId } = await params;
  const locale = requireLocale(rawLocale);

  const sessionView = await orFail(loadSession(pageId));
  // The stored page is authoritative; a URL that disagrees with it is simply wrong.
  if (sessionView.page.websiteId !== websiteId) {
    notFound();
  }

  const [websiteView, datasets] = await Promise.all([
    orFail(loadWebsite(websiteId)),
    orFail(
      dataSourceQueries.listCompatibleDatasets.execute({
        websiteId,
        canonicalKinds: collectDatasetTypes(sessionView.components),
      }),
    ),
  ]);
  const datasetOptions = toDatasetOptionsByType(
    datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      canonicalKind: dataset.canonicalKind,
      sourceName: dataset.source.name,
    })),
  );

  const categoryKinds = collectCategoryTypes(sessionView.components);
  const categoryOptions = await componentPlatformQueries.listContentCategories
    .execute({
      websiteId,
      kinds: categoryKinds,
      datasets: datasets
        .filter((dataset) => categoryKinds.includes(dataset.canonicalKind))
        .map((dataset) => ({ id: dataset.id, kind: dataset.canonicalKind })),
    })
    // Cannot fail: an unreadable dataset just offers no categories.
    .match((view) => view, assertNever);

  return (
    <I18nProvider locale={locale} namespaces={['builder', 'componentPlatform']}>
      <BuilderSessionProvider
        key={sessionView.page.id}
        session={toEditorSessionDto(sessionView)}
        datasetOptions={datasetOptions}
        categoryOptions={categoryOptions}
        initialSelection={firstOf((await searchParams)['select'])}
      >
        <BuilderShell
          pageTitle={sessionView.page.title}
          themeStyle={themeToCssVariables(websiteView.theme)}
          links={{
            pages: builderRoutes.pages(websiteId),
            publicSite: releaseRoutes.publicSite(websiteView.slug, sessionView.page.path),
          }}
        />
      </BuilderSessionProvider>
    </I18nProvider>
  );
}

export default function BuilderPage(props: RouteProps) {
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <BuilderContent {...props} />
    </Suspense>
  );
}
