import { describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { AuthReleaseAccess } from '@modules/release/infrastructure/access/auth-release-access';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const actor: Actor = {
  id: toActorId('actor-1'),
  tenantId: toTenantId('open-site'),
  roles: ['admin'],
};

function accessWith(authorizeWebsiteAccess: ReturnType<typeof vi.fn>) {
  return new AuthReleaseAccess(
    () => ({ authorizeWebsiteAccess: { execute: authorizeWebsiteAccess } }) as never,
    { requireActor: () => okAsync(actor) },
  );
}

describe('AuthReleaseAccess', () => {
  it('scopes the actor to the authorized website, not the one the request has open', async () => {
    const authorize = vi.fn(() => okAsync(toTenantId('target-site')));

    const scope = await accessWith(authorize).authorizeWebsite('release.read', 'target-site');

    expect(authorize).toHaveBeenCalledWith('release.read', 'target-site');
    expect(scope._unsafeUnwrap()).toMatchObject({
      websiteId: 'target-site',
      actor: { id: 'actor-1', tenantId: 'target-site' },
    });
  });

  it('refuses an id that is not a string before asking auth anything', async () => {
    const authorize = vi.fn();

    const result = await accessWith(authorize).authorizeWebsite('release.read', 42);

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
    expect(authorize).not.toHaveBeenCalled();
  });

  it('refuses an id of the wrong shape before asking auth anything', async () => {
    const authorize = vi.fn();

    const result = await accessWith(authorize).authorizeWebsite('release.read', '');

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
    expect(authorize).not.toHaveBeenCalled();
  });

  it("passes on auth's refusal unchanged", async () => {
    const refusal = forbiddenError('auth.permission_denied', 'Not allowed.');
    const authorize = vi.fn(() => errAsync(refusal));

    const result = await accessWith(authorize).authorizeWebsite('release.publish', 'target-site');

    expect(result._unsafeUnwrapErr()).toBe(refusal);
  });
});
