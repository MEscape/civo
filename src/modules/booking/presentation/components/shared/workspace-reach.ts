import { cache } from 'react';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getBookingQueries } from '../../../composition';
import { bookingRoutes } from '../../routes';

/** A website's bookings, as another place a row of the websites list leads to. */
export interface WebsiteBookingLink {
  readonly href: string;
  readonly label: string;
}

/**
 * The websites the signed-in person works in through bookings, read once per request: the hub, the
 * switcher in a workspace's name and the websites list share it. Without any it is empty.
 */
export const loadBookingWorkspaces = cache(async () => {
  const reach = await orNull(getBookingQueries().listWorkspaces.execute());
  return reach ?? { websites: [], hasOpenableWebsite: false, isTruncated: false };
});

/** Where someone with no website to open goes: their one workspace, or the choice of them; nowhere without any. */
function landingOf(websites: ReadonlyArray<{ readonly id: string }>): string | undefined {
  const [first] = websites;
  if (first === undefined) {
    return undefined;
  }
  return websites.length === 1 ? bookingRoutes.admin(first.id) : bookingRoutes.workspaces();
}

/**
 * What the websites list needs of the bookings, so the page itself knows nothing of them: the way into a
 * website's bookings for the rows that have one, the websites that can only be worked in through
 * bookings (an employee's: rows with just that way in), and, for someone who has no website to open at
 * all, where to go instead of an empty list.
 */
export async function loadWebsiteListLinks(locale: Locale) {
  const [t, { websites, hasOpenableWebsite }] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    loadBookingWorkspaces(),
  ]);
  const linkTo = (id: string): WebsiteBookingLink => ({
    href: bookingRoutes.admin(id),
    label: t('workspace.rowOpen'),
  });

  return {
    landing: hasOpenableWebsite ? undefined : landingOf(websites),
    alsoOpen: (websiteId: string) =>
      websites.some(({ id }) => id === websiteId) ? linkTo(websiteId) : undefined,
    elsewhere: websites
      .filter(({ canOpenWebsite }) => !canOpenWebsite)
      .map(({ id, name }) => ({ id, name, link: linkTo(id) })),
  };
}
