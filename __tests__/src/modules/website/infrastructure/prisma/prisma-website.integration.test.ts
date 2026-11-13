/**
 * A tenant is its website. This proves it against a REAL Postgres: the store
 * gives a new website one id for both, and the table itself refuses any other
 * pairing. Needs the database of `DATABASE_URL` (see `vitest.integration.config.ts`) with the migrations
 * applied: `npm run test:integration`.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { createWebsiteDraft } from '@modules/website/domain/models/website';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { PrismaWebsiteRepository } from '@modules/website/infrastructure/prisma/prisma-website.repository';

import { db, disconnectDb } from '@lib/db';

describe('website persistence (real Postgres)', () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const websites = new PrismaWebsiteRepository();
  const slugs = [`it-site-${suffix}`, `it-bad-${suffix}`, `it-theme-${suffix}`];

  afterAll(async () => {
    for (const slug of slugs) {
      await db.orm.public.Website.where({ slug }).deleteAndCount();
    }
    await disconnectDb();
  });

  it("stores a new website as its own tenant, and lists every tenant's websites", async () => {
    const draft = createWebsiteDraft({
      name: 'Integration town',
      slug: slugs[0] ?? '',
      description: null,
      templateKey: 'municipal',
    })._unsafeUnwrap();

    const created = (
      await websites.create({ draft, theme: DEFAULT_WEBSITE_THEME })
    )._unsafeUnwrap();

    expect(created.tenantId).toBe(created.id);
    expect(
      (await websites.findById(created.id, toTenantId(created.id)))._unsafeUnwrap()?.slug,
    ).toBe(slugs[0]);
    // Another tenant's id finds nothing; the platform list is not tenant-scoped.
    expect(
      (await websites.findById(created.id, toTenantId(`other-${suffix}`)))._unsafeUnwrap(),
    ).toBeNull();
    const listed = (await websites.list({ page: 1, pageSize: 100 }, null))._unsafeUnwrap();
    expect(listed.items.map((website) => website.id)).toContain(created.id);
    const scoped = (await websites.list({ page: 1, pageSize: 100 }, [created.id]))._unsafeUnwrap();
    expect(scoped.total).toBe(1);
    expect(scoped.items.map(({ id }) => id)).toEqual([created.id]);
    expect((await websites.list({ page: 1, pageSize: 100 }, []))._unsafeUnwrap().total).toBe(0);
  });

  it('refuses a website whose tenant is not itself', async () => {
    await expect(
      db.orm.public.Website.create({
        tenantId: `elsewhere-${suffix}`,
        name: 'Mismatch',
        slug: slugs[1] ?? '',
        templateKey: 'municipal',
      }),
    ).rejects.toThrow();
  });

  it('completes concurrent theme edits and refuses a foreign tenant without changing the theme', async () => {
    const draft = createWebsiteDraft({
      name: 'Theme town',
      slug: slugs[2] ?? '',
      description: null,
      templateKey: 'municipal',
    })._unsafeUnwrap();
    const website = (
      await websites.create({ draft, theme: DEFAULT_WEBSITE_THEME })
    )._unsafeUnwrap();
    const first = {
      ...DEFAULT_WEBSITE_THEME,
      colors: { ...DEFAULT_WEBSITE_THEME.colors, primary: '#112233' },
    };
    const second = {
      ...DEFAULT_WEBSITE_THEME,
      colors: { ...DEFAULT_WEBSITE_THEME.colors, primary: '#445566' },
    };
    const results = await Promise.all([
      websites.updateTheme(website.id, website.tenantId, first),
      websites.updateTheme(website.id, website.tenantId, second),
    ]);
    expect(results.map((result) => result._unsafeUnwrap().theme.colors.primary)).toEqual([
      '#112233',
      '#445566',
    ]);
    const before = (await websites.findById(website.id, website.tenantId))._unsafeUnwrap();
    expect(
      (
        await websites.updateTheme(website.id, toTenantId('foreign'), DEFAULT_WEBSITE_THEME)
      )._unsafeUnwrapErr().kind,
    ).toBe('not_found');
    expect((await websites.findById(website.id, website.tenantId))._unsafeUnwrap()).toEqual(before);
  });
});
