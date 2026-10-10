import { cache } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  BuilderSessionProvider,
  BuilderShell,
  builderQueries,
  collectCategoryTypes,
  collectDatasetTypes,
  toDatasetOptionsByType,
  toEditorSessionDto,
} from '@modules/builder';
import { componentPlatformQueries } from '@modules/component-platform';
import { dataSourceQueries } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { themeToCssVariables, websiteQueries, websiteRoutes } from '@modules/website';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { assertNever } from '@lib/utils';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; pageId: string }>;
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

export default async function BuilderPage({ params }: RouteProps) {
  const { websiteId, pageId } = await params;

  const sessionView = await orFail(loadSession(pageId));
  // The stored page is authoritative; a URL that disagrees with it is simply wrong.
  if (sessionView.page.websiteId !== websiteId) {
    notFound();
  }

  const [websiteView, datasets] = await Promise.all([
    orFail(websiteQueries.getWebsiteById.execute(websiteId)),
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
    <BuilderSessionProvider
      key={sessionView.page.id}
      session={toEditorSessionDto(sessionView)}
      datasetOptions={datasetOptions}
      categoryOptions={categoryOptions}
    >
      <BuilderShell
        website={{ name: websiteView.name }}
        pageTitle={sessionView.page.title}
        themeStyle={themeToCssVariables(websiteView.theme)}
        links={{
          websites: websiteRoutes.list(),
          publicSite: releaseRoutes.publicSite(websiteView.slug),
          settings: websiteRoutes.settings(websiteView.id),
        }}
      />
    </BuilderSessionProvider>
  );
}
