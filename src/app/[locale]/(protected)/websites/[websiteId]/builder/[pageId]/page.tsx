import { cache } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import {
  BuilderSessionProvider,
  BuilderShell,
  builderQueries,
  collectDatasetTypes,
  toDatasetOptionsByType,
  toEditorSessionDto,
} from '@modules/builder';
import { dataSourceQueries } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { themeToCssVariables, websiteQueries, websiteRoutes } from '@modules/website';

import { getTranslations } from '@i18n/server';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ websiteId: string; pageId: string }>;
}

/** Deduplicates the load between `generateMetadata` and the page within one request. */
const loadSession = cache((pageId: string) => builderQueries.getEditorSession.execute(pageId));

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { pageId } = await params;
  const t = await getTranslations('builder');
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

  return (
    <BuilderSessionProvider
      key={sessionView.page.id}
      session={toEditorSessionDto(sessionView)}
      datasetOptions={datasetOptions}
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
