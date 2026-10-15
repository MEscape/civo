import { literalGuard } from '@lib/utils';

import type { Permission } from './permission';

/** The roles a tenant can hand out: invitations, role changes and member lists know no others. */
export const ROLES = ['admin', 'editor', 'contributor', 'viewer', 'employee'] as const;
export type TenantRole = (typeof ROLES)[number];

/**
 * The platform administrator: the one role that is not tenant-scoped. It
 * runs the platform (creating and listing websites) and, inside whichever
 * website it opens, holds a tenant administrator's permissions. It is never
 * a tenant role: no request can invite anyone to it, and a membership row that
 * names it inside a tenant is ignored. The one exception is the deployment's
 * own administrator list, which is mailed an invitation at start
 * (`InviteBootstrapAdmins`) because sign-up is closed.
 */
export const PLATFORM_ADMIN_ROLE = 'platform_admin';
export type PlatformRole = typeof PLATFORM_ADMIN_ROLE;

export type Role = TenantRole | PlatformRole;

/**
 * `satisfies Record<Role, ...>` turns a missing role into a compile error,
 * and `as const` keeps each list narrow. This table is code, not data, on
 * purpose: it is versioned, reviewed, and cannot be changed by a request.
 * Move it to storage only when a real requirement for runtime-editable
 * roles appears.
 */
const ROLE_PERMISSIONS = {
  admin: [
    'website.read',
    'website.update',
    'theme.update',
    'release.read',
    'release.publish',
    'release.rollback',
    'datasource.create',
    'datasource.read',
    'datasource.test',
    'datasource.delete',
    'dataset.create',
    'dataset.read',
    'dataset.update',
    'dataset.delete',
    'dataset.map',
    'page.create',
    'page.read',
    'page.update',
    'page.delete',
    'page.restructure',
    'booking.read',
    'booking.read.own',
    'booking.configure',
    'booking.manage',
    'user.read',
    'user.manage',
  ],
  editor: [
    'website.read',
    'release.read',
    'dataset.read',
    'page.create',
    'page.read',
    'page.update',
    'page.restructure',
    'booking.read',
    'booking.read.own',
    'booking.configure',
    'booking.manage',
  ],
  // The platform's own: what no tenant role holds, plus a tenant administrator's permissions
  // for the website it has open (the list below, filled in after the table).
  platform_admin: [],
  // Content only: the page editor with its restricted scope (no `page.restructure`, see
  // `mayRestructure`). `dataset.read` and `page.read` are what opening it takes.
  contributor: ['website.read', 'release.read', 'dataset.read', 'page.read', 'page.update'],
  // Looks, never changes. The editor is a writing tool (opening it takes `page.update`), so a
  // viewer holds nothing that only the editor or the settings would read.
  viewer: ['website.read', 'release.read', 'booking.read', 'booking.read.own'],
  // An employee sets up their own place in the booking system (hours, location, the services
  // they offer) and sees the bookings on it. Nothing else of the platform is theirs.
  employee: ['booking.read.own', 'booking.profile.own'],
} as const satisfies Record<Role, readonly Permission[]>;

const PLATFORM_ONLY_PERMISSIONS: readonly Permission[] = [
  'website.create',
  'website.list.all',
  'platform.admin.manage',
];

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return role === PLATFORM_ADMIN_ROLE
    ? [...ROLE_PERMISSIONS.admin, ...PLATFORM_ONLY_PERMISSIONS]
    : ROLE_PERMISSIONS[role];
}

/** Narrows untrusted text (a stored row, a request) to a tenant role. A platform role is none. */
export const isRole = literalGuard(ROLES);

/** Narrows untrusted text to any role, the platform's included. Only configuration uses this. */
export const isAnyRole = literalGuard([...ROLES, PLATFORM_ADMIN_ROLE] as const);
