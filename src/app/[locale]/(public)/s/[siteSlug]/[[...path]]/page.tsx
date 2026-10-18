import { cache } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { restoreStoredPageConfig } from '@modules/builder';
import { renderPageNodes } from '@modules/component-platform';
import { releaseQueries } from '@modules/release';
import { releaseRoutes } from '@modules/release/client';
import { restoreStoredWebsiteTheme, ThemeProvider, websiteQueries } from '@modules/website';

import { PoweredBy } from '@components/brand/powered-by';

import { redirect, requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildContentMetadata } from '@lib/seo';

import { findBookingPagePath } from '@/app/_lib/booking-page';
import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ locale: string; siteSlug: string; path?: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The parameter the e-mail links carry: the reference of a booking to open (see the booking flow). */
const MANAGE_PARAM = 'manage';

/**
 * One published page: slug → website → LIVE release → page by path. Drafts are
 * never read here, only the snapshot a release froze, so what visitors see
 * changes only when someone publishes or rolls back. Shared by the metadata
 * and the page within one request.
 *
 * The database driver draws random ids, which a prerender may not do; `connection()`
 * makes the load a per-request one before the first query runs.
 */
const loadPublishedPage = cache(async (siteSlug: string, path: string) => {
  await connection();
  const website = await orFail(websiteQueries.getPublicWebsiteBySlug.execute(siteSlug));
  const snapshot = await orFail(releaseQueries.getPublishedSnapshot.execute(website.id));

  const page = snapshot.pages.find((candidate) => candidate.path === path);
  if (page === undefined) {
    notFound();
  }

  // The builder is the only module that knows what a valid tree is. A snapshot it
  // cannot read is a fault of ours (corrupted storage), never of the visitor.
  const config = await orFail(restoreStoredPageConfig(page.config));

  return { snapshot, page, config };
});

const toPath = (segments: readonly string[] | undefined) => (segments ?? []).join('/');

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { siteSlug, path } = await params;
  const { snapshot, page } = await loadPublishedPage(siteSlug, toPath(path));
  const pagePath = toPath(path);

  return buildContentMetadata({
    pathname: releaseRoutes.publicSite(siteSlug, pagePath),
    title: `${page.title} | ${snapshot.website.name}`,
    description: snapshot.website.description ?? snapshot.website.name,
    siteName: snapshot.website.name,
  });
}

/**
 * A link from a booking e-mail names the website, not a page: the editor put
 * the booking wherever they liked. This page, or the one that holds the
 * booking, answers it; the booking then opens on its own (`manage`).
 */
function redirectToBooking(
  snapshot: Awaited<ReturnType<typeof loadPublishedPage>>['snapshot'],
  locale: Locale,
  {
    siteSlug,
    currentPath,
    reference,
  }: { siteSlug: string; currentPath: string; reference: string },
): void {
  const target = findBookingPagePath(snapshot.pages, currentPath);
  if (target !== null && target !== currentPath) {
    const href = `${releaseRoutes.publicSite(siteSlug, target)}?${MANAGE_PARAM}=${encodeURIComponent(reference)}#booking`;
    redirect({ href, locale });
  }
}

export default async function PublishedSitePage({ params, searchParams }: RouteProps) {
  const { siteSlug, path, locale: rawLocale } = await params;
  const locale = requireLocale(rawLocale);
  const [{ snapshot, config }, app, query] = await Promise.all([
    loadPublishedPage(siteSlug, toPath(path)),
    getTranslations({ locale, namespace: 'app' }),
    searchParams,
  ]);
  const reference = query[MANAGE_PARAM];
  if (typeof reference === 'string' && reference !== '') {
    redirectToBooking(snapshot, locale, { siteSlug, currentPath: toPath(path), reference });
  }

  return (
    <ThemeProvider
      theme={restoreStoredWebsiteTheme(snapshot.theme)}
      className="flex min-h-dvh flex-col"
    >
      <div className="flex-1">
        {renderPageNodes(config.children, { mode: 'published', websiteId: snapshot.website.id })}
      </div>
      {/* The municipality's own logo is the site's; this is only who built it. */}
      <PoweredBy label={app('brand.poweredBy')} className="flex justify-center px-4 py-6" />
    </ThemeProvider>
  );
}
