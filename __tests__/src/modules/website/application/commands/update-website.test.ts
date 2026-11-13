import { describe, expect, it } from 'vitest';

import { UpdateWebsite } from '@modules/website/application/commands/update-website';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { SCOPE_IDS } from '../../../auth/application/support/user-management-scope-world';
import { world } from '../support/website-world';

describe('update-website through auth permissions', () => {
  it('updates the authorized target and audits its tenant rather than the currently selected tenant', async () => {
    const { deps, writes, events } = world();
    const result = await new UpdateWebsite(deps).execute({ id: SCOPE_IDS.b, name: 'New name' });
    expect(result._unsafeUnwrap().name).toBe('New name');
    expect(writes).toEqual([SCOPE_IDS.b]);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'website.updated',
        actorId: SCOPE_IDS.manager,
        tenantId: SCOPE_IDS.b,
        websiteId: SCOPE_IDS.b,
        changedFields: ['name'],
      }),
    ]);
  });

  it('does not write or audit a details edit with no actual changes', async () => {
    const { deps, writes, events } = world();
    expect(
      (
        await new UpdateWebsite(deps).execute({ id: SCOPE_IDS.b, name: `Website ${SCOPE_IDS.b}` })
      ).isOk(),
    ).toBe(true);
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it('refuses an edit where the caller only has read access before reading website data', async () => {
    const { deps, reads, writes, events } = world();
    const result = await new UpdateWebsite(deps).execute({ id: SCOPE_IDS.c, name: 'Forbidden' });
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it('rejects a foreign record even if a repository violates its tenant-scoped contract', async () => {
    const { deps, stored, writes, events } = world();
    deps.websites.findById = () => okAsync(stored.get(SCOPE_IDS.a) ?? null);
    expect(
      (
        await new UpdateWebsite(deps).execute({ id: SCOPE_IDS.b, name: 'New name' })
      )._unsafeUnwrapErr().kind,
    ).toBe('not_found');
    expect(writes).toEqual([]);
    expect(events).toEqual([]);
  });

  it('propagates persistence failures and emits no success event', async () => {
    const { deps, events } = world();
    const failure = infrastructureError('website.persistence_failed', 'Unavailable', null);
    deps.websites.update = () => errAsync(failure);
    expect(
      (
        await new UpdateWebsite(deps).execute({ id: SCOPE_IDS.b, name: 'New name' })
      )._unsafeUnwrapErr(),
    ).toBe(failure);
    expect(events).toEqual([]);
  });
});
