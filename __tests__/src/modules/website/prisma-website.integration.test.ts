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
  const slugs = [`it-site-${suffix}`, `it-bad-${suffix}`];

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
    const listed = (await websites.list({ page: 1, pageSize: 100 }))._unsafeUnwrap();
    expect(listed.items.map((website) => website.id)).toContain(created.id);
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
});
