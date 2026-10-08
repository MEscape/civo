import { literalGuard } from '@lib/utils';

import type { Permission } from './permission';

export const ROLES = ['admin', 'editor', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * `satisfies Record<Role, ...>` turns a missing role into a compile error,
 * and `as const` keeps each list narrow. This table is code, not data, on
 * purpose: it is versioned, reviewed, and cannot be changed by a request.
 * Move it to storage only when a real requirement for runtime-editable
 * roles appears.
 */
const ROLE_PERMISSIONS = {
  admin: [
    'website.create',
    'website.read',
    'website.update',
    'website.delete',
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
  ],
  editor: [
    'website.read',
    'release.read',
    'datasource.read',
    'dataset.read',
    'page.create',
    'page.read',
    'page.update',
    'page.restructure',
  ],
  viewer: ['website.read', 'release.read', 'datasource.read', 'dataset.read', 'page.read'],
} as const satisfies Record<Role, readonly Permission[]>;

/** Every permission a single role grants. Combining roles is `decide`'s job. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Narrows untrusted text (a stored row, an env value) to a known role. */
export const isRole = literalGuard(ROLES);
