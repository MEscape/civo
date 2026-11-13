import { describe, expect, it } from 'vitest';

import type { PreviewInvitationDependencies } from '@modules/auth/application/auth-dependencies';
import { PreviewInvitation } from '@modules/auth/application/queries/preview-invitation';
import { unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import { toInvitationId, toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';

import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
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
function query(
  stored: Invitation | null,
  options: {
    readonly isDown?: boolean;
    readonly websiteDown?: boolean;
    readonly websiteName?: string | null;
  } = {},
) {
  const deps: PreviewInvitationDependencies = {
    invitations: {
      createPending: () => errAsync(infrastructureError('auth.persistence_failed', 'not used')),
      accept: () => okAsync('unavailable'),
      revoke: () => okAsync(false),
      hasOpenForEmail: () => okAsync(false),
      countOpen: () => okAsync(0),
      listOpenForTenants: (_tenantIds, _now, page) => okAsync(toPage([], 0, page)),
      findByTokenHash: (hash: string) =>
        options.isDown === true
          ? errAsync(infrastructureError('auth.persistence_failed', 'down'))
          : okAsync(hash === 'nekot' ? stored : null),
    },
    tokens: {
      hash: (token) => Array.from(token).reverse().join(''),
      issue: () => ({ token: 'token', hash: 'nekot' }),
    },
    clock: { now: () => NOW },
    currentActor: { getCurrentActor: () => errAsync(unauthenticated()) },
    directory: {
      findByEmail: () => okAsync(null),
      search: (request) => okAsync(toPage([], 0, request.page)),
    },
    tenants: {
      listNames: () => okAsync({ websites: [], isTruncated: false }),
      exists: () => okAsync(true),
      findName: (tenantId) => {
        if (options.websiteDown === true) {
          return errAsync(infrastructureError('auth.website_failed', 'down'));
        }
        const name = options.websiteName === undefined ? 'Ada Town' : options.websiteName;
        return okAsync(tenantId === 'site-1' ? name : null);
      },
    },
  };
  return new PreviewInvitation(deps);
}

describe('looking at an invitation before accepting it', () => {
  it('shows an open invitation: whom it is for, in which role, in whose website, until when', async () => {
    expect((await query(invitation()).execute('token'))._unsafeUnwrap()).toEqual({
      email: 'ada@example.org',
      role: 'editor',
      organisation: 'Ada Town',
      expiresAt: new Date('2027-01-10T12:00:00Z'),
      requiresExistingAccount: false,
      canAcceptExistingAccount: false,
      invitedBy: null,
    });
  });

  it('shows nothing for a link that is unknown, used or expired, and the three look alike', async () => {
    const invalid = [
      await query(invitation()).execute('another'),
      await query(null).execute('token'),
      await query(invitation({ acceptedAt: new Date('2027-01-04T12:00:00Z') })).execute('token'),
      await query(invitation({ expiresAt: new Date('2027-01-05T11:59:59Z') })).execute('token'),
      await query(invitation({ expiresAt: NOW })).execute('token'),
    ];
    expect(invalid.map((result) => result._unsafeUnwrap())).toEqual([null, null, null, null, null]);
  });

  it('returns only presentation fields, never ids, hashes or tenant identifiers', async () => {
    const preview = (await query(invitation()).execute('token'))._unsafeUnwrap();
    expect(Object.keys(preview ?? {}).sort()).toEqual([
      'canAcceptExistingAccount',
      'email',
      'expiresAt',
      'invitedBy',
      'organisation',
      'requiresExistingAccount',
      'role',
    ]);
  });

  it('fails when the store is down rather than calling a good link invalid', async () => {
    const result = await query(invitation(), { isDown: true }).execute('token');
    expect(result._unsafeUnwrapErr().kind).toBe('infrastructure');
  });

  it('rejects invitations whose website is missing rather than drawing an unscoped offer', async () => {
    expect(
      (await query(invitation(), { websiteName: null }).execute('token'))._unsafeUnwrap(),
    ).toBeNull();
    expect(
      (
        await query(invitation({ tenantId: toTenantId('other-site') })).execute('token')
      )._unsafeUnwrap(),
    ).toBeNull();
  });

  it('preserves a website lookup failure instead of returning an invitation without its organisation', async () => {
    const result = await query(invitation(), { websiteDown: true }).execute('token');
    expect(result._unsafeUnwrapErr().code).toBe('auth.website_failed');
  });

  it('does not look up website data before validating the invitation', async () => {
    const result = await query(invitation({ acceptedAt: NOW }), { websiteDown: true }).execute(
      'token',
    );
    expect(result._unsafeUnwrap()).toBeNull();
  });

  it('represents platform invitations without looking for a website', async () => {
    const result = await query(
      invitation({ tenantId: toTenantId('platform'), role: 'platform_admin' }),
      { websiteDown: true },
    ).execute('token');
    expect(result._unsafeUnwrap()).toMatchObject({ role: 'platform_admin', organisation: null });
  });

  it('rejects mismatched platform roles and reserved scopes', async () => {
    for (const entry of [
      invitation({ role: 'platform_admin' }),
      invitation({ tenantId: toTenantId('platform') }),
      invitation({ tenantId: toTenantId('unassigned') }),
    ]) {
      expect(
        (await query(entry, { websiteDown: true }).execute('token'))._unsafeUnwrap(),
      ).toBeNull();
    }
  });

  it('rejects malformed or oversized tokens without reaching persistence and never changes token meaning', async () => {
    for (const token of ['', ' token', 'token ', 'to/ken', 't'.repeat(513), 'to\u{1f48c}ken']) {
      expect(
        (await query(invitation(), { isDown: true }).execute(token))._unsafeUnwrap(),
      ).toBeNull();
    }
    expect((await query(invitation()).execute('TOKEN'))._unsafeUnwrap()).toBeNull();
    expect(
      (await query(invitation(), { isDown: true }).execute('t'.repeat(512)))._unsafeUnwrapErr()
        .kind,
    ).toBe('infrastructure');
  });
});
