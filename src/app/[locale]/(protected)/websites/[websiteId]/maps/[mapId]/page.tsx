import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MapEditor } from '@modules/map';

import { MapEditorSkeleton } from '@components/skeletons/map-editor-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { mapScreen } from '../map-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; mapId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'map',
  });
  return buildPrivateMetadata(t('management.editorTitle'));
}

async function EditorContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId, mapId } = await params;
  const [access, query] = await Promise.all([getWebsiteAccess(), searchParams]);
  const { builderHref, usage, deleteMap } = mapScreen(access, websiteId);
  return (
    <MapEditor
      builderHref={builderHref}
      websiteId={websiteId}
      mapId={mapId}
      locale={requireLocale(locale)}
      searchParams={query}
      canEdit={access.may('page.update')}
      canPublish={access.may('release.publish')}
      usage={usage}
      deleteMap={deleteMap}
    />
  );
}

export default function MapEditorPage(props: RouteProps) {
  return (
    <Suspense fallback={<MapEditorSkeleton hasAction />}>
      <EditorContent {...props} />
    </Suspense>
  );
}
