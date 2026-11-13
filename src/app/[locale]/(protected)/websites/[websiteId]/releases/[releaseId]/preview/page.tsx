import { Suspense } from 'react';

import type { Metadata } from 'next';

import { restoreStoredPageConfig } from '@modules/builder';
import { renderPageNodes } from '@modules/component-platform';
import { restorePublishedMaps } from '@modules/map';
import { ReleasePreview } from '@modules/release';
import type { PublishedPageView, PublishedSnapshotView } from '@modules/release';
import { restoreStoredWebsiteTheme, ThemeProvider } from '@modules/website';

import { ReleasePreviewSkeleton } from '@components/skeletons/release-preview-skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; releaseId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('pages.releases.title'));
}

/**
 * A frozen page drawn as the public site draws it, or nothing when its stored form cannot be read.
 * The builder, the component platform and the website each know a part of this; the release
 * module does not, so the application hands it in.
 */
function renderFrozenPage(page: PublishedPageView, snapshot: PublishedSnapshotView) {
  const restored = restoreStoredPageConfig(page.config);
  if (restored.isErr()) {
    return null;
  }
  return (
    <ThemeProvider theme={restoreStoredWebsiteTheme(snapshot.theme)} className="min-h-96">
      {renderPageNodes(restored.value.children, {
        mode: 'published',
        websiteId: snapshot.website.id,
        publishedMaps: restorePublishedMaps(snapshot.maps),
      })}
    </ThemeProvider>
  );
}

async function ReleasePreviewContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, releaseId } = await params;
  const access = await getWebsiteAccess();

  return (
    <ReleasePreview
      locale={requireLocale(rawLocale)}
      websiteId={websiteId}
      releaseId={releaseId}
      searchParams={await searchParams}
      mayRollback={access.may('release.rollback')}
      renderPage={renderFrozenPage}
    />
  );
}

export default function ReleasePreviewPage(props: RouteProps) {
  return (
    <Suspense fallback={<ReleasePreviewSkeleton />}>
      <ReleasePreviewContent {...props} />
    </Suspense>
  );
}
