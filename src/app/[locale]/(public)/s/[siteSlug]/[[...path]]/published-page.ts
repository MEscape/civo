import { cache } from 'react';

import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { BOOKING_MANAGE_PARAM, BOOKING_SECTION_ANCHOR } from '@modules/booking/client';
import { findBookingPagePath, restoreStoredPageConfig } from '@modules/builder';
import { getReleaseQueries } from '@modules/release';
import { releaseRoutes } from '@modules/release/client';
import { getWebsiteQueries } from '@modules/website';

import { redirect } from '@i18n';
import type { Locale } from '@i18n';

import { orFail } from '@/app/_lib/or-fail';

/**
 * One published page: slug → website → LIVE release → page by path. Drafts are
 * never read here, only the snapshot a release froze, so what visitors see
 * changes only when someone publishes or rolls back. Shared by the metadata
 * and the page within one request.
 *
 * The database driver draws random ids, which a prerender may not do; `connection()`
 * makes the load a per-request one before the first query runs.
 */
export const loadPublishedPage = cache(async (siteSlug: string, path: string) => {
  await connection();
  const website = await orFail(getWebsiteQueries().getPublicWebsiteBySlug.execute(siteSlug));
  const snapshot = await orFail(getReleaseQueries().getPublishedSnapshot.execute(website.id));

  const page = snapshot.pages.find((candidate) => candidate.path === path);
  if (page === undefined) {
    notFound();
  }

  // The builder is the only module that knows what a valid tree is. A snapshot it
  // cannot read is a fault of ours (corrupted storage), never of the visitor.
  const config = await orFail(restoreStoredPageConfig(page.config));

  return { snapshot, page, config };
});

/**
 * A link from a booking e-mail names the website, not a page: the editor put
 * the booking wherever they liked. This page, or the one that holds the
 * booking, answers it; the booking then opens on its own (`manage`).
 */
export function redirectToBooking(
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
    const href = `${releaseRoutes.publicSite(siteSlug, target)}?${BOOKING_MANAGE_PARAM}=${encodeURIComponent(reference)}#${BOOKING_SECTION_ANCHOR}`;
    redirect({ href, locale });
  }
}
