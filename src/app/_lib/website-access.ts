import { cache } from 'react';

import { getCurrentTenantId, getHeldPermissions, isAuthEnabled, PERMISSIONS } from '@modules/auth';
import type { Permission } from '@modules/auth';
import { bookingRoutes } from '@modules/booking/client';
import { builderRoutes } from '@modules/builder/client';
import { dataSourceRoutes } from '@modules/data-sources';
import { mapRoutes } from '@modules/map/client';
import { mediaRoutes } from '@modules/media/client';
import { releaseRoutes } from '@modules/release/client';
import { websiteRoutes } from '@modules/website/client';

type WebsiteSectionKey =
  | 'overview'
  | 'builder'
  | 'bookings'
  | 'releases'
  | 'data'
  | 'media'
  | 'maps'
  | 'settings'
  | 'users'
  | 'audit';

interface WebsiteSection {
  readonly key: WebsiteSectionKey;
  readonly href: string;
  readonly label: `nav.${WebsiteSectionKey}`;
  readonly isAdministration: boolean;
}

/**
 * What it takes to do something in a section, not merely to look at it: a
 * section whose every control is out of reach is not offered. An actor
 * needs any one permission of a section's list. Listed in display order.
 */
const SECTIONS = {
  overview: {
    permissions: ['website.read'],
    href: websiteRoutes.detail,
    label: 'nav.overview',
    isAdministration: false,
  },
  builder: {
    permissions: ['page.update'],
    href: builderRoutes.pages,
    label: 'nav.builder',
    isAdministration: false,
  },
  bookings: {
    permissions: ['booking.read', 'booking.read.own'],
    href: bookingRoutes.admin,
    label: 'nav.bookings',
    isAdministration: false,
  },
  releases: {
    permissions: ['release.read', 'release.publish'],
    href: releaseRoutes.releases,
    label: 'nav.releases',
    isAdministration: false,
  },
  media: {
    permissions: ['media.read'],
    href: mediaRoutes.library,
    label: 'nav.media',
    isAdministration: false,
  },
  maps: {
    permissions: ['page.read', 'page.update'],
    href: mapRoutes.list,
    label: 'nav.maps',
    isAdministration: false,
  },
  data: {
    permissions: ['datasource.create'],
    href: dataSourceRoutes.sources,
    label: 'nav.data',
    isAdministration: false,
  },
  settings: {
    permissions: ['website.update', 'theme.update'],
    href: websiteRoutes.settings,
    label: 'nav.settings',
    isAdministration: true,
  },
  users: {
    permissions: ['user.read'],
    href: websiteRoutes.users,
    label: 'nav.users',
    isAdministration: true,
  },
  audit: {
    permissions: ['audit.read'],
    href: websiteRoutes.audit,
    label: 'nav.audit',
    isAdministration: true,
  },
} as const satisfies Record<
  WebsiteSectionKey,
  {
    readonly permissions: readonly Permission[];
    readonly href: (websiteId: string) => string;
    readonly label: WebsiteSection['label'];
    readonly isAdministration: boolean;
  }
>;

const SECTION_KEYS = Object.keys(SECTIONS) as WebsiteSectionKey[];

/**
 * What the current actor may do, as the admin screens ask for it. Screens
 * draw only what the actor can use; this is display, never the protection:
 * every use case behind a control authorizes on its own.
 */
interface WebsiteAccess {
  /** Whether the actor holds the permission a control or a block of the screen needs. */
  readonly may: (permission: Permission) => boolean;
  /** Whether the actor can do anything in the section. The tabs, the cards and the section's own page ask this. */
  readonly maySection: (key: WebsiteSectionKey) => boolean;
  /** The sections of one website the actor may use, in display order. */
  readonly sections: (websiteId: string) => readonly WebsiteSection[];
  /**
   * The request's selected membership scope, or `null` for platform/unassigned scope.
   * Memberships in other websites remain available through auth's accessible-website query.
   */
  readonly tenantId: string | null;
}

/** Builds display capabilities; authorization remains in each application use case. */
function createWebsiteAccess(
  held: ReadonlySet<Permission>,
  isSignInEnabled: boolean,
  tenantId: string | null,
): WebsiteAccess {
  const may = (permission: Permission) => held.has(permission);
  // Users live in the authentication store, which only exists while sign-in does.
  const maySection = (key: WebsiteSectionKey) =>
    SECTIONS[key].permissions.some(may) && (key !== 'users' || isSignInEnabled);

  const sections = (websiteId: string) => {
    return SECTION_KEYS.filter(maySection).map((key): WebsiteSection => ({
      key,
      href: SECTIONS[key].href(websiteId),
      label: SECTIONS[key].label,
      isAdministration: SECTIONS[key].isAdministration,
    }));
  };

  return {
    may,
    maySection,
    sections,
    tenantId,
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
