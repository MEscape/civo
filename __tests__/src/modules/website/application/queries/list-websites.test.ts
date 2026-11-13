import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import type { TenantRepository } from '@modules/auth/domain/ports/tenant.repository';
import { ListWebsites } from '@modules/website/application/queries/list-websites';
import { toWebsiteId } from '@modules/website/domain/models/ids';

import { okAsync } from '@lib/result';

import { SCOPE_IDS } from '../../../auth/application/support/user-management-scope-world';
import { world } from '../support/website-world';

describe('list-websites through auth permissions', () => {
  it('lists every readable membership independently of the currently selected tenant', async () => {
    const { deps, stored } = world();
    const reference = stored.get(SCOPE_IDS.a);
    if (reference === undefined) {
      throw new Error('Missing fixture website');
    }
    stored.set('secret', {
      ...reference,
      id: toWebsiteId('secret'),
      tenantId: toTenantId('secret'),
    });
    const page = (await new ListWebsites(deps).execute())._unsafeUnwrap();
    expect(page.items.map(({ id }) => id)).toEqual([SCOPE_IDS.a, SCOPE_IDS.b, SCOPE_IDS.c]);
    expect(page.total).toBe(3);
    expect(page.isWebsitesTruncated).toBe(false);
  });

  it('applies revoked membership before totals and clamps pagination to the remaining scope', async () => {
    const { deps, auth } = world();
    auth.roster.get(SCOPE_IDS.a)?.delete(SCOPE_IDS.manager);
    const page = (await new ListWebsites(deps).execute({ page: 99, pageSize: 1 }))._unsafeUnwrap();
    expect(page.items.map(({ id }) => id)).toEqual([SCOPE_IDS.c]);
    expect(page).toMatchObject({ total: 2, page: 2, pageCount: 2 });
  });

  it('allows platform authority to list websites without any membership', async () => {
    const { deps } = world({ platform: true });
    expect((await new ListWebsites(deps).execute())._unsafeUnwrap().total).toBe(3);
  });

  it('does not cap the platform table when auth caps only selector names', async () => {
    const { deps, auth } = world({ platform: true });
    const tenants: TenantRepository = auth.deps.tenants;
    tenants.listNames = () => okAsync({ websites: [], isTruncated: true });
    const page = (await new ListWebsites(deps).execute())._unsafeUnwrap();
    expect(page).toMatchObject({ total: 3, isWebsitesTruncated: false });
  });

  it('never widens an empty readable allowlist', async () => {
    const { deps } = world();
    deps.access.listReadableWebsites = () => okAsync({ websiteIds: [], isTruncated: false });
    const page = (await new ListWebsites(deps).execute())._unsafeUnwrap();
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('refuses a caller without readable memberships before reading website data', async () => {
    const { deps, auth, reads } = world();
    for (const members of auth.roster.values()) {
      members.delete(SCOPE_IDS.manager);
    }
    expect((await new ListWebsites(deps).execute())._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(reads).toEqual([]);
  });

  it('reports an incomplete auth reach without widening it', async () => {
    const { deps } = world();
    deps.access.listReadableWebsites = () =>
      okAsync({ websiteIds: [toWebsiteId(SCOPE_IDS.a)], isTruncated: true });
    const page = (await new ListWebsites(deps).execute())._unsafeUnwrap();
    expect(page).toMatchObject({ total: 1, isWebsitesTruncated: true });
    expect(page.items.map(({ id }) => id)).toEqual([SCOPE_IDS.a]);
  });
});
