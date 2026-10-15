import { describe, expect, it } from 'vitest';

import type { Permission } from '@modules/auth/domain/models/permission';
import { PLATFORM_ADMIN_ROLE, ROLES, permissionsForRole } from '@modules/auth/domain/models/role';
import type { TenantRole } from '@modules/auth/domain/models/role';

import { createWebsiteAccess } from '@/app/_lib/website-access';

const access = (
  permissions: readonly Permission[],
  isSignInEnabled = true,
  tenantId: string | null = 'w1',
) => createWebsiteAccess(new Set(permissions), isSignInEnabled, tenantId);

const keys = (permissions: readonly Permission[], isSignInEnabled = true) =>
  access(permissions, isSignInEnabled)
    .sections('w1')
    .map(({ key }) => key);

describe('website access', () => {
  describe('sections', () => {
    it('are offered for what the actor can do in them, not for what they could look at', () => {
      expect(keys(['website.read', 'page.update'])).toEqual(['overview', 'builder']);
      expect(keys(['website.read', 'datasource.read'])).toEqual(['overview']);
    });

    it('offer the releases to anyone who may read them, publishing is a control inside', () => {
      expect(keys(['website.read', 'release.read'])).toEqual(['overview', 'releases']);
      expect(keys(['website.read', 'release.publish'])).toEqual(['overview', 'releases']);
    });

    it('offer settings to anyone who may change any part of it', () => {
      for (const permission of ['website.update', 'theme.update', 'datasource.create'] as const) {
        expect(keys([permission])).toEqual(['settings']);
      }
      expect(keys(['datasource.read', 'dataset.read'])).toEqual([]);
    });

    it('lead an employee to the bookings only', () => {
      expect(keys(['booking.read.own'])).toEqual(['bookings']);
    });

    it('are none for someone who holds none of the permissions', () => {
      expect(keys([])).toEqual([]);
    });

    it('add user administration last, and only while sign-in is enabled', () => {
      expect(keys(['website.read', 'user.read'])).toEqual(['overview', 'users']);
      expect(keys(['website.read', 'user.read'], false)).toEqual(['overview']);
    });

    it('point at the requested website', () => {
      const sections = access(['website.read', 'page.update', 'booking.read']).sections('w1');

      expect(sections).toHaveLength(3);
      expect(sections.every(({ href }) => href.startsWith('/websites/w1'))).toBe(true);
    });
  });

  describe('may and maySection', () => {
    it('answer from the held permissions alone', () => {
      const current = access(['release.publish', 'datasource.create']);

      expect(current.may('release.publish')).toBe(true);
      expect(current.may('release.rollback')).toBe(false);
      expect(current.maySection('releases')).toBe(true);
      expect(current.maySection('settings')).toBe(true);
      expect(current.maySection('builder')).toBe(false);
    });
  });

  // The real role table, not hand-picked permissions: a change to a role's grants must be seen here.
  describe('for each role', () => {
    const SECTIONS_BY_ROLE = {
      admin: ['overview', 'builder', 'bookings', 'releases', 'settings', 'users'],
      editor: ['overview', 'builder', 'bookings', 'releases'],
      contributor: ['overview', 'builder', 'releases'],
      viewer: ['overview', 'bookings', 'releases'],
      employee: ['bookings'],
    } as const satisfies Record<TenantRole, readonly string[]>;

    it.each(ROLES)('%s', (role) => {
      expect(keys(permissionsForRole(role))).toEqual(SECTIONS_BY_ROLE[role]);
    });

    it('platform administrator, inside a website: everything an administrator has', () => {
      expect(keys(permissionsForRole(PLATFORM_ADMIN_ROLE))).toEqual(SECTIONS_BY_ROLE.admin);
    });
  });

  describe('the website list and where everyone else starts', () => {
    it('belongs to the platform administrator alone', () => {
      expect(access(permissionsForRole(PLATFORM_ADMIN_ROLE)).may('website.list.all')).toBe(true);
      for (const role of ROLES) {
        expect(access(permissionsForRole(role)).may('website.list.all'), role).toBe(false);
        expect(access(permissionsForRole(role)).may('website.create'), role).toBe(false);
      }
    });

    it('sends a member to the first section of their own website', () => {
      expect(access(permissionsForRole('editor'), true, 'site-9').landing()).toBe(
        '/websites/site-9',
      );
      expect(access(permissionsForRole('employee'), true, 'site-9').landing()).toBe(
        '/websites/site-9/bookings',
      );
    });

    it('has nowhere to send someone who stands in no website', () => {
      expect(access(permissionsForRole(PLATFORM_ADMIN_ROLE), true, null).landing()).toBeNull();
      expect(access([], true, 'site-9').landing()).toBeNull();
    });
  });
});
