import { cache } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { restoreStoredPageConfig } from '@modules/builder';
import { renderPageNodes } from '@modules/component-platform';
import { releaseQueries } from '@modules/release';
import { restoreStoredWebsiteTheme, ThemeProvider, websiteQueries } from '@modules/website';

import { buildContentMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

interface RouteProps {
  readonly params: Promise<{ siteSlug: string; path?: string[] }>;
}

/**
 * One published page: slug → website → LIVE release → page by path. Drafts are
 * never read here, only the snapshot a release froze, so what visitors see
 * changes only when someone publishes or rolls back. Shared by the metadata
 * and the page within one request.
 */
const loadPublishedPage = cache(async (siteSlug: string, path: string) => {
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
    pathname: pagePath === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${pagePath}`,
    title: `${page.title} | ${snapshot.website.name}`,
    description: snapshot.website.description ?? snapshot.website.name,
    siteName: snapshot.website.name,
  });
}

export default async function PublishedSitePage({ params }: RouteProps) {
  const { siteSlug, path } = await params;
  const { snapshot, config } = await loadPublishedPage(siteSlug, toPath(path));

  return (
    <ThemeProvider theme={restoreStoredWebsiteTheme(snapshot.theme)} className="min-h-dvh">
      {renderPageNodes(config.children, { mode: 'published', websiteId: snapshot.website.id })}
    </ThemeProvider>
  );
}
