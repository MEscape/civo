import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import {
  whereInWorkspace,
  workspaceLinks,
} from '@modules/booking/presentation/forms/workspace-nav';
import type { WorkspaceLinksInput } from '@modules/booking/presentation/forms/workspace-nav';
import enBooking from '@modules/booking/presentation/i18n/en.json';

const t = createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' });

const input = (overrides: Partial<WorkspaceLinksInput> = {}): WorkspaceLinksInput => ({
  t,
  websiteId: 'site',
  mayManage: true,
  mayConfigure: true,
  mayServe: false,
  mayClaim: false,
  mayProfile: false,
  hasCalendar: true,
  hasLocation: true,
  openCount: 0,
  unreadCount: 0,
  ...overrides,
});

const byArea = (links: ReturnType<typeof workspaceLinks>, area: string) =>
  links.find((link) => link.area === area);

describe('workspaceLinks', () => {
  it('offers every area of a manager, the team only to who may configure', () => {
    const areas = workspaceLinks(input()).map(({ area }) => area);
    expect(areas).toEqual([
      'overview',
      'calendar',
      'bookings',
      'locations',
      'services',
      'resources',
      'team',
    ]);
    expect(workspaceLinks(input({ mayConfigure: false })).map(({ area }) => area)).not.toContain(
      'team',
    );
  });

  it('switches off what needs a location until one exists, and keeps the rest open', () => {
    const links = workspaceLinks(input({ hasLocation: false }));
    expect(byArea(links, 'overview')?.isDisabled).toBeUndefined();
    expect(byArea(links, 'locations')?.isDisabled).toBeUndefined();
    for (const area of ['calendar', 'bookings', 'services', 'resources', 'team']) {
      expect(byArea(links, area)?.isDisabled).toBe(true);
    }
  });

  it('gives the areas of a location an address template for the location in view', () => {
    const services = byArea(workspaceLinks(input()), 'services');
    expect(services?.href).toBe('/bookings/site/services');
    expect(services?.locationHref).toBe('/bookings/site/locations/:location/services');
  });

  it('shows an employee the own pages as tabs, with counts only when there is something', () => {
    const links = workspaceLinks(
      input({ mayManage: false, mayServe: true, mayClaim: true, mayProfile: true, openCount: 3 }),
    );
    expect(links.map(({ area }) => area)).toEqual([
      'start',
      'open',
      'plan',
      'preferences',
      'messages',
      'profile',
    ]);
    expect(byArea(links, 'open')?.label).toBe('Open bookings (3)');
    expect(byArea(links, 'messages')?.label).toBe('Messages');
    expect(links.every(({ group }) => group === undefined)).toBe(true);
  });

  it('puts the own pages of a manager who also serves behind one group', () => {
    const links = workspaceLinks(input({ mayServe: true, mayClaim: true, mayProfile: true }));
    expect(byArea(links, 'start')?.group).toBe('My work');
    expect(byArea(links, 'overview')?.group).toBeUndefined();
  });

  it('gives a manager who serves every page an employee has, the profile included', () => {
    const links = workspaceLinks(
      input({ mayServe: true, mayClaim: true, mayProfile: true, unreadCount: 2 }),
    );
    const own = links.filter(({ group }) => group === 'My work').map(({ area }) => area);
    expect(own).toEqual(['start', 'open', 'plan', 'preferences', 'messages', 'profile']);
    expect(byArea(links, 'profile')?.label).toBe('My profile');
    expect(byArea(links, 'messages')?.label).toBe('Messages (2)');
  });

  it('leaves out "My work" for a manager who is on no team, since there is nothing of their own to show', () => {
    const links = workspaceLinks(input({ mayServe: true, mayClaim: true, hasCalendar: false }));
    expect(links.some(({ group }) => group !== undefined)).toBe(false);
  });

  it('keeps the pages of someone who only serves even before a manager gave them a calendar', () => {
    const links = workspaceLinks(
      input({
        mayManage: false,
        mayServe: true,
        mayClaim: true,
        mayProfile: true,
        hasCalendar: false,
      }),
    );
    expect(links.map(({ area }) => area)).toContain('start');
  });

  it('shows the pages all or none: a role that only reads has no work of its own to open', () => {
    // Administrators, editors and viewers may read their own pages but cannot take bookings or keep a calendar.
    const links = workspaceLinks(input({ mayServe: true, mayClaim: false, mayProfile: false }));

    expect(links.some(({ group }) => group !== undefined)).toBe(false);
    expect(workspaceLinks(input({ mayManage: false, mayServe: true, mayClaim: false }))).toEqual(
      [],
    );
  });

  it('offers nothing to someone who may neither manage nor serve', () => {
    expect(workspaceLinks(input({ mayManage: false }))).toEqual([]);
  });
});

describe('whereInWorkspace', () => {
  it.each([
    ['/bookings/site', 'overview', undefined],
    ['/bookings/site/calendar', 'calendar', undefined],
    ['/bookings/site/list', 'bookings', undefined],
    ['/bookings/site/locations', 'locations', undefined],
    ['/bookings/site/locations/new', 'locations', undefined],
    ['/bookings/site/locations/l1', 'locations', 'l1'],
    ['/bookings/site/locations/l1/edit', 'locations', 'l1'],
    ['/bookings/site/locations/l1/services', 'services', 'l1'],
    ['/bookings/site/locations/l1/services/s1/edit', 'services', 'l1'],
    ['/bookings/site/locations/l1/resources/new', 'resources', 'l1'],
    ['/bookings/site/locations/l1/team/e1', 'team', 'l1'],
    ['/bookings/site/services', 'services', undefined],
    ['/bookings/site/me', 'start', undefined],
    ['/bookings/site/me/open', 'open', undefined],
    ['/bookings/site/me/profile', 'profile', undefined],
  ])('reads %s as %s at %s', (pathname, area, locationId) => {
    expect(whereInWorkspace(pathname)).toEqual({ area, locationId });
  });

  it('knows nothing before the path is known', () => {
    expect(whereInWorkspace(null)).toEqual({ area: undefined, locationId: undefined });
  });
});
