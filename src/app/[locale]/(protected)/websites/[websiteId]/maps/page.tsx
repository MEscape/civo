import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MapsAdministration } from '@modules/map';

import { MapsPageSkeleton } from '@components/skeletons/maps-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { mapScreen } from './map-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'map',
  });
  return buildPrivateMetadata(t('management.title'));
}

async function MapsContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId } = await params;
  const [access, query] = await Promise.all([getWebsiteAccess(), searchParams]);
  const { builderHref, usage, deleteMap, canPublish } = mapScreen(access, websiteId);
  return (
    <MapsAdministration
      builderHref={builderHref}
      websiteId={websiteId}
      locale={requireLocale(locale)}
      searchParams={query}
      canEdit={access.may('page.update')}
      canPublish={canPublish}
      usage={usage}
      deleteMap={deleteMap}
    />
  );
}

export default function MapsPage(props: RouteProps) {
  return (
    <Suspense fallback={<MapsPageSkeleton />}>
      <MapsContent {...props} />
    </Suspense>
  );
}
