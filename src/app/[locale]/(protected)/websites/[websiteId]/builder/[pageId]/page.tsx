import { Suspense } from 'react';

import type { Metadata } from 'next';

import { getBookingQueries } from '@modules/booking';
import { BuilderEditor, loadEditorSession } from '@modules/builder';
import { getComponentPlatformQueries } from '@modules/component-platform';
import { dataSourceQueries } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { themeToCssVariables, loadWebsite } from '@modules/website';

import { BuilderEditorSkeleton } from '@components/skeletons/builder-editor-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; pageId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: rawLocale, websiteId, pageId } = await params;
  const t = await getTranslations({ locale: requireLocale(rawLocale), namespace: 'builder' });
  const result = await loadEditorSession(websiteId, pageId);
  return {
    title: result.match(
      (session) => t('metadata.title', { pageTitle: session.page.title }),
      () => t('metadata.fallbackTitle'),
    ),
    robots: { index: false },
  };
}

async function BuilderContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, pageId } = await params;
  const website = await orFail(loadWebsite(websiteId));

  return (
    <BuilderEditor
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      pageId={pageId}
      searchParams={await searchParams}
      choices={{
        listCompatibleDatasets: dataSourceQueries.listCompatibleDatasets,
        listContentCategories: getComponentPlatformQueries().listContentCategories,
        getBookingChoices: {
          execute: () => getBookingQueries().getBookingChoices.execute({ websiteId }),
        },
      }}
      themeStyle={themeToCssVariables(website.theme)}
      publicSiteHref={(pagePath) => releaseRoutes.publicSite(website.slug, pagePath)}
    />
  );
}

export default function BuilderPage(props: RouteProps) {
  return (
    <Suspense fallback={<BuilderEditorSkeleton />}>
      <BuilderContent {...props} />
    </Suspense>
  );
}
