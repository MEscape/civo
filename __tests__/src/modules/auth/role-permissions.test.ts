import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@modules/auth/domain/models/permission';
import type { Permission } from '@modules/auth/domain/models/permission';
import {
  PLATFORM_ADMIN_ROLE,
  ROLES,
  isRole,
  permissionsForRole,
} from '@modules/auth/domain/models/role';
import type { Role } from '@modules/auth/domain/models/role';
import { createRoleSet } from '@modules/auth/domain/models/role-set';
import { mayRestructure } from '@modules/builder/application/services/may-restructure';

const holds = (role: Role, permission: Permission) => permissionsForRole(role).includes(permission);

/**
 * The role table is the one place that says who may do what. These tests pin
 * the properties the rest of the application relies on, so a grant cannot
 * drift into a combination that no screen or use case supports.
 */
describe('role table', () => {
  it('grants only known permissions, each at most once', () => {
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(new Set(granted).size).toBe(granted.length);
      expect(granted.every((permission) => PERMISSIONS.includes(permission))).toBe(true);
    }
  });

  it('gives a role that can open the editor everything opening it takes', () => {
    // The editor session needs `page.update`; its route reads the website, the page list and the datasets.
    const openers = ROLES.filter((role) => holds(role, 'page.update'));

    expect(openers).toEqual(['admin', 'editor', 'contributor']);
    for (const role of openers) {
      for (const needed of ['website.read', 'page.read', 'dataset.read'] as const) {
        expect(holds(role, needed), `${role} lacks ${needed}`).toBe(true);
      }
    }
  });

  it('keeps the viewer read-only, with nothing only the editor or the settings would read', () => {
    const viewer = permissionsForRole('viewer');

    expect(viewer.every((permission) => /\.read(\.own)?$/.test(permission))).toBe(true);
    for (const editorOnly of ['page.read', 'dataset.read', 'datasource.read'] as const) {
      expect(viewer).not.toContain(editorOnly);
    }
  });

  it('keeps the contributor to the content of existing pages', () => {
    const contributor = permissionsForRole('contributor');

    for (const denied of [
      'page.create',
      'page.restructure',
      'theme.update',
      'website.update',
      'datasource.create',
      'release.publish',
      'booking.read',
      'user.read',
    ] as const) {
      expect(contributor, `contributor holds ${denied}`).not.toContain(denied);
    }
  });

  it('lets only those who may restructure pages change the structure of a page', () => {
    const may = (role: Role) =>
      mayRestructure({ id: 'a1', tenantId: 't1', roles: [role] } as never);

    expect(may('admin')).toBe(true);
    expect(may('editor')).toBe(true);
    expect(may('contributor')).toBe(false);
  });

  describe('the platform administrator', () => {
    it('is the only role that creates and lists websites', () => {
      for (const permission of [
        'website.create',
        'website.list.all',
        'platform.admin.manage',
      ] as const) {
        expect(holds(PLATFORM_ADMIN_ROLE, permission)).toBe(true);
        for (const role of ROLES) {
          expect(holds(role, permission), `${role} holds ${permission}`).toBe(false);
        }
      }
    });

    it('holds every permission of an administrator for the website it works in', () => {
      for (const permission of permissionsForRole('admin')) {
        expect(holds(PLATFORM_ADMIN_ROLE, permission)).toBe(true);
      }
    });

    it('is no tenant role: nobody can be invited to it or given it', () => {
      expect(ROLES).not.toContain(PLATFORM_ADMIN_ROLE);
      expect(isRole(PLATFORM_ADMIN_ROLE)).toBe(false);
      expect(createRoleSet([PLATFORM_ADMIN_ROLE]).isErr()).toBe(true);
      expect(createRoleSet(['admin', PLATFORM_ADMIN_ROLE]).isErr()).toBe(true);
    });
  });
});
