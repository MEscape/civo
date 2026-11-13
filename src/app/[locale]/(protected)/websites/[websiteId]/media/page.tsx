import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MediaAdministration, mediaRoutes } from '@modules/media';

import { MediaPageSkeleton } from '@components/skeletons/media-page-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

import { mediaScreen } from './media-screen';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'media' });
  return buildPrivateMetadata(t('library.metadataTitle'));
}

async function MediaContent({ params, searchParams }: RouteProps) {
  const { locale, websiteId } = await params;
  const [access, query] = await Promise.all([getWebsiteAccess(), searchParams]);
  const { mayUpload, mayDelete, usage } = mediaScreen(access);
  return (
    <MediaAdministration
      locale={requireLocale(locale)}
      websiteId={websiteId}
      pathname={mediaRoutes.library(websiteId)}
      searchParams={query}
      mayUpload={mayUpload}
      mayDelete={mayDelete}
      usage={usage}
    />
  );
}

export default function MediaPage(props: RouteProps) {
  return (
    <Suspense fallback={<MediaPageSkeleton />}>
      <MediaContent {...props} />
    </Suspense>
  );
}
