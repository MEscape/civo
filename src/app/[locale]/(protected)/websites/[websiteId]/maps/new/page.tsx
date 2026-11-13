import { Suspense } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { MapEditor } from '@modules/map';

import { MapEditorSkeleton } from '@components/skeletons/map-editor-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { mapScreen } from '../map-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'map',
  });
  return buildPrivateMetadata(t('management.create'));
}

async function CreateContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId } = await params;
  const [access, query] = await Promise.all([getWebsiteAccess(), searchParams]);
  if (!access.may('page.update')) {
    notFound();
  }
  const { builderHref, usage } = mapScreen(access, websiteId);
  return (
    <MapEditor
      builderHref={builderHref}
      websiteId={websiteId}
      locale={requireLocale(locale)}
      searchParams={query}
      canEdit
      canPublish={access.may('release.publish')}
      usage={usage}
    />
  );
}

export default function CreateMapPage(props: RouteProps) {
  return (
    <Suspense fallback={<MapEditorSkeleton />}>
      <CreateContent {...props} />
    </Suspense>
  );
}
