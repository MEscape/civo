import type { Metadata } from 'next';

import { BOOKING_MANAGE_PARAM } from '@modules/booking/client';
import { renderPublishedSitePage } from '@modules/component-platform';
import { releaseRoutes } from '@modules/release/client';
import { restoreStoredWebsiteTheme, ThemeProvider } from '@modules/website';

import { PoweredBy } from '@components/brand/powered-by';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildContentMetadata } from '@lib/seo';

import { loadPublishedPage, redirectToBooking } from './published-page';

interface RouteProps {
  readonly params: Promise<{ locale: string; siteSlug: string; path?: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Blocking on purpose: the response is the complete page. A streamed page
 * arrives as hidden segments that only inline scripts reveal, so a visitor
 * without JavaScript would get an empty document. There is no `loading.tsx`
 * here or in `(public)` for the same reason.
 */
export const instant = false;

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

export default async function PublishedSitePage({ params, searchParams }: RouteProps) {
  const { siteSlug, path, locale: rawLocale } = await params;
  const locale = requireLocale(rawLocale);
  const [{ snapshot, config }, app, query] = await Promise.all([
    loadPublishedPage(siteSlug, toPath(path)),
    getTranslations({ locale, namespace: 'app' }),
    searchParams,
  ]);
  const reference = query[BOOKING_MANAGE_PARAM];
  if (typeof reference === 'string' && reference !== '') {
    redirectToBooking(snapshot, locale, { siteSlug, currentPath: toPath(path), reference });
  }

  return (
    <ThemeProvider
      theme={restoreStoredWebsiteTheme(snapshot.theme)}
      className="flex min-h-dvh flex-col"
    >
      {renderPublishedSitePage(config.children, {
        mode: 'published',
        websiteId: snapshot.website.id,
      })}
      {/* The municipality's own logo is the site's; this is only who built it. */}
      <PoweredBy label={app('brand.poweredBy')} className="flex justify-center px-4 py-6" />
    </ThemeProvider>
  );
}
