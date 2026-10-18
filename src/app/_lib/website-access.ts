import { cache } from 'react';

import { getCurrentTenantId, getHeldPermissions, isAuthEnabled, PERMISSIONS } from '@modules/auth';
import type { Permission } from '@modules/auth';
import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceRoutes } from '@modules/data-sources';
import { releaseRoutes } from '@modules/release/client';
import { websiteRoutes } from '@modules/website/client';

export type WebsiteSectionKey =
  'overview' | 'builder' | 'bookings' | 'releases' | 'data' | 'settings' | 'users' | 'audit';

export interface WebsiteSection {
  readonly key: WebsiteSectionKey;
  readonly href: string;
}

/**
 * What it takes to do something in a section, not merely to look at it: a
 * section whose every control is out of reach is not offered. An actor
 * needs any one permission of a section's list. Listed in display order.
 */
const SECTION_PERMISSIONS = {
  overview: ['website.read'],
  builder: ['page.update'],
  bookings: ['booking.read', 'booking.read.own'],
  releases: ['release.read', 'release.publish'],
  data: ['datasource.create'],
  settings: ['website.update', 'theme.update'],
  users: ['user.read'],
  audit: ['audit.read'],
} as const satisfies Record<WebsiteSectionKey, readonly Permission[]>;

const SECTION_KEYS = Object.keys(SECTION_PERMISSIONS) as WebsiteSectionKey[];

/**
 * What the current actor may do, as the admin screens ask for it. Screens
 * draw only what the actor can use; this is display, never the protection:
 * every use case behind a control authorizes on its own.
 */
export interface WebsiteAccess {
  /** Whether the actor holds the permission a control or a block of the screen needs. */
  readonly may: (permission: Permission) => boolean;
  /** Whether the actor can do anything in the section. The tabs, the cards and the section's own page ask this. */
  readonly maySection: (key: WebsiteSectionKey) => boolean;
  /** The sections of one website the actor may use, in display order. */
  readonly sections: (websiteId: string) => readonly WebsiteSection[];
  /**
   * The website the actor is working in (a tenant is its website), or `null`
   * when they stand in none: a platform administrator with no website open.
   */
  readonly tenantId: string | null;
  /** Where someone lands who has a website of their own and no list of websites to choose from. */
  readonly landing: () => string | null;
}

/** The pure part, so the rules are tested without a request. */
export function createWebsiteAccess(
  held: ReadonlySet<Permission>,
  isSignInEnabled: boolean,
  tenantId: string | null,
): WebsiteAccess {
  const may = (permission: Permission) => held.has(permission);
  // Users live in the authentication store, which only exists while sign-in does.
  const maySection = (key: WebsiteSectionKey) =>
    SECTION_PERMISSIONS[key].some(may) && (key !== 'users' || isSignInEnabled);

  const sections = (websiteId: string) => {
    const hrefs: Record<WebsiteSectionKey, string> = {
      overview: websiteRoutes.detail(websiteId),
      builder: builderRoutes.pages(websiteId),
      bookings: bookingRoutes.admin(websiteId),
      releases: releaseRoutes.releases(websiteId),
      data: dataSourceRoutes.sources(websiteId),
      settings: websiteRoutes.settings(websiteId),
      users: websiteRoutes.users(websiteId),
      audit: websiteRoutes.audit(websiteId),
    };
    return SECTION_KEYS.filter(maySection).map((key) => ({ key, href: hrefs[key] }));
  };

  return {
    may,
    maySection,
    sections,
    tenantId,
    landing: () => (tenantId === null ? null : (sections(tenantId)[0]?.href ?? null)),
  };
}

/**
 * Resolved once per request: the layout and the page under it share one
 * answer instead of each asking the session again.
 */
export const getWebsiteAccess = cache(async (): Promise<WebsiteAccess> => {
  const [held, tenantId] = await Promise.all([
    getHeldPermissions(PERMISSIONS),
    getCurrentTenantId(),
  ]);
  return createWebsiteAccess(held, isAuthEnabled, tenantId);
});
