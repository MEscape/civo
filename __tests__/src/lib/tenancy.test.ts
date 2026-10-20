import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { websiteRoutes } from '@modules/website/presentation/routes';

import { TENANT_HINT_HEADER, tenantHintFromPathname } from '@lib/tenancy';

const ID = '3f2b8c1e-5d4a-4f6b-9a7c-0e1d2c3b4a59';

describe('TENANT_HINT_HEADER', () => {
  it('is a request header the platform owns', () => {
    expect(TENANT_HINT_HEADER).toBe('x-civo-tenant');
  });
});

describe('tenantHintFromPathname', () => {
  it.each([
    [`/de/websites/${ID}`, ID],
    [`/en/websites/${ID}/builder/p1`, ID],
    [`/de/websites/${ID}/`, ID],
    [`/de/websites/${ID.toUpperCase()}/bookings`, ID.toUpperCase()],
  ])('names the website in %s', (pathname, expected) => {
    expect(tenantHintFromPathname(pathname)).toBe(expected);
  });

  it.each([
    // The list and the platform's own screens sit beside the websites but are not one.
    '/de/websites',
    '/de/websites/',
    '/de/websites/users',
    '/de/websites/audit',
    // Not the admin area.
    '/de/sign-in',
    '/',
    '',
    `/s/town/websites/${ID}`,
    `/de/s/websites/${ID}`,
    `/websites/${ID}`,
    // Not a website id.
    '/de/websites/abc-123',
    '/de/websites/a%20b',
    `/de/websites/${ID}x`,
    `/de/websites/${ID.replaceAll('-', '')}`,
    `/de/websites/${'x'.repeat(65)}`,
    '/de/websites/platform',
    '/de/websites/unassigned',
  ])('names no website in "%s"', (pathname) => {
    expect(tenantHintFromPathname(pathname)).toBeNull();
  });

  it('reads every id the platform issues', () => {
    for (let issued = 0; issued < 50; issued += 1) {
      const id = randomUUID();

      expect(tenantHintFromPathname(`/de/websites/${id}`)).toBe(id);
    }
  });
});

describe('tenantHintFromPathname against the website route table', () => {
  const localized = (path: string) => `/de${path}`;

  it('names the website for every route that belongs to one', () => {
    for (const route of [
      websiteRoutes.detail,
      websiteRoutes.settings,
      websiteRoutes.users,
      websiteRoutes.audit,
    ]) {
      expect(tenantHintFromPathname(localized(route(ID)))).toBe(ID);
    }
  });

  it('names none for the routes of the platform itself', () => {
    for (const path of [
      websiteRoutes.list(),
      websiteRoutes.platformAudit(),
      websiteRoutes.platformUsers(),
    ]) {
      expect(tenantHintFromPathname(localized(path))).toBeNull();
    }
  });
});
