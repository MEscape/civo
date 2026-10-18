import { describe, expect, it } from 'vitest';

import type { PreviewInvitationDependencies } from '@modules/auth/application/auth-dependencies';
import { PreviewInvitation } from '@modules/auth/application/queries/preview-invitation';
import { toInvitationId, toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const NOW = new Date('2027-01-05T12:00:00Z');

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: toInvitationId('inv-1'),
    tenantId: toTenantId('site-1'),
    email: 'ada@example.org',
    role: 'editor',
    invitedBy: toActorId('admin-1'),
    expiresAt: new Date('2027-01-10T12:00:00Z'),
    acceptedAt: null,
    createdAt: new Date('2027-01-03T12:00:00Z'),
    ...overrides,
  };
}

/** One stored invitation, found by the hash of its token, which here is the token reversed. */
function query(stored: Invitation | null, options: { readonly isDown?: boolean } = {}) {
  const deps = {
    invitations: {
      findByTokenHash: (hash: string) =>
        options.isDown === true
          ? errAsync(infrastructureError('auth.persistence_failed', 'down'))
          : okAsync(hash === 'nekot' ? stored : null),
    },
    tokens: { hash: (token: string) => Array.from(token).reverse().join('') },
    clock: { now: () => NOW },
  } as unknown as PreviewInvitationDependencies;
  return new PreviewInvitation(deps);
}

describe('looking at an invitation before accepting it', () => {
  it('shows an open invitation: whom it is for, in which role, in whose website, until when', async () => {
    const preview = await query(invitation()).execute('token');

    expect(preview._unsafeUnwrap()).toEqual({
      email: 'ada@example.org',
      role: 'editor',
      tenantId: 'site-1',
      expiresAt: new Date('2027-01-10T12:00:00Z'),
    });
  });

  it('shows nothing for a link that is unknown, used or expired, and the three look alike', async () => {
    const unknown = await query(invitation()).execute('another');
    const used = await query(invitation({ acceptedAt: new Date('2027-01-04T12:00:00Z') })).execute(
      'token',
    );
    const expired = await query(
      invitation({ expiresAt: new Date('2027-01-05T11:59:59Z') }),
    ).execute('token');

    expect(unknown._unsafeUnwrap()).toBeNull();
    expect(used._unsafeUnwrap()).toBeNull();
    expect(expired._unsafeUnwrap()).toBeNull();
  });

  it('never lets out the stored record: no id, no inviter, no hash', async () => {
    const preview = (await query(invitation()).execute('token'))._unsafeUnwrap();

    expect(Object.keys(preview ?? {}).sort()).toEqual(['email', 'expiresAt', 'role', 'tenantId']);
  });

  it('fails when the store is down rather than calling a good link invalid', async () => {
    const result = await query(invitation(), { isDown: true }).execute('token');

    expect(result.isErr()).toBe(true);
  });
});
