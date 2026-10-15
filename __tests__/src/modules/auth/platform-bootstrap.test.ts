import { describe, expect, it } from 'vitest';

import { AcceptInvitation } from '@modules/auth/application/commands/accept-invitation';
import { InviteBootstrapAdmins } from '@modules/auth/application/commands/invite-bootstrap-admins';
import { invalidToken } from '@modules/auth/domain/errors/auth-errors';
import { toActorId, toInvitationId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, InvitationId, TenantId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';
import { PLATFORM_ADMIN_ROLE } from '@modules/auth/domain/models/role';
import type { TenantRole } from '@modules/auth/domain/models/role';
import { PLATFORM_TENANT_ID } from '@modules/auth/domain/models/tenant';
import type {
  InvitationRepository,
  NewInvitation,
} from '@modules/auth/domain/ports/invitation.repository';
import type { SecurityEvent } from '@modules/auth/domain/ports/security-audit-log.port';
import type { UserDirectory } from '@modules/auth/domain/ports/user-directory.port';

import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const NOW = new Date('2026-10-13T10:00:00Z');
const EXISTING = toActorId('existing-1');

interface Stored extends Invitation {
  readonly tokenHash: string;
}

function world(
  options: { readonly mailFails?: boolean; readonly accounts?: readonly string[] } = {},
) {
  const stored = new Map<string, Stored>();
  const sent: Array<{ to: string; token: string; locale: string }> = [];
  const events: SecurityEvent[] = [];
  const platformAdmins = new Set<ActorId>();
  const tenantRoles = new Map<string, TenantRole[]>();
  const accounts = new Set(options.accounts ?? []);
  let counter = 0;

  const invitations: InvitationRepository = {
    create: (draft: NewInvitation) => {
      counter += 1;
      const invitation: Stored = {
        id: toInvitationId(`inv-${counter}`),
        tenantId: draft.tenantId,
        email: draft.email,
        role: draft.role,
        invitedBy: draft.invitedBy,
        expiresAt: draft.expiresAt,
        acceptedAt: null,
        createdAt: NOW,
        tokenHash: draft.tokenHash,
      };
      stored.set(invitation.id, invitation);
      return okAsync(invitation);
    },
    findByTokenHash: (hash) =>
      okAsync([...stored.values()].find((entry) => entry.tokenHash === hash) ?? null),
    claim: (id: InvitationId) => {
      const entry = stored.get(id);
      if (entry?.acceptedAt !== null) {
        return okAsync(false);
      }
      stored.set(id, { ...entry, acceptedAt: NOW });
      return okAsync(true);
    },
    release: () => okAsync(undefined),
    listOpen: (tenantId: TenantId, _now, page) => {
      const open = [...stored.values()].filter(
        (entry) =>
          entry.tenantId === tenantId && entry.acceptedAt === null && entry.expiresAt > NOW,
      );
      return okAsync(toPage(open, open.length, page));
    },
    revoke: (id: InvitationId) => {
      stored.delete(id);
      return okAsync(undefined);
    },
  };

  const directory: UserDirectory = {
    search: (query) => okAsync(toPage([], 0, query.page)),
    findByEmail: (email) =>
      okAsync(
        accounts.has(email)
          ? { id: EXISTING, email, name: 'Known', emailVerified: true, createdAt: NOW }
          : null,
      ),
  };

  const tokens = {
    issue: () => {
      const token = `token-${counter + 1}`;
      return { token, hash: `hash:${token}` };
    },
    hash: (token: string) => `hash:${token}`,
  };

  const mailer = {
    sendInvitation: (message: { to: string; token: string; locale: string }) => {
      if (options.mailFails === true) {
        return errAsync(infrastructureError('auth.mail_failed', 'The mail could not be sent.'));
      }
      sent.push(message);
      return okAsync(undefined);
    },
  };

  const members = {
    setPlatformAdmin: (id: ActorId, isAdministrator: boolean) => {
      if (isAdministrator) {
        platformAdmins.add(id);
      }
      return okAsync(undefined);
    },
    replaceRoles: (id: ActorId, tenantId: TenantId, roles: readonly TenantRole[]) => {
      tenantRoles.set(`${tenantId}:${id}`, [...roles]);
      return okAsync(undefined);
    },
  };

  const audit = { record: (event: SecurityEvent) => void events.push(event) };
  const clock = { now: () => NOW };

  const invite = new InviteBootstrapAdmins({
    directory,
    invitations,
    tokens,
    mailer: {
      ...mailer,
      sendPasswordReset: () => okAsync(undefined),
      sendVerification: () => okAsync(undefined),
      sendExistingAccountNotice: () => okAsync(undefined),
    },
    audit,
    clock,
  });

  const accept = new AcceptInvitation({
    authenticator: {
      signUp: (draft: { email: string }) => {
        accounts.add(draft.email);
        return okAsync(undefined);
      },
    } as never,
    rateLimiter: { consume: () => okAsync({ isAllowed: true }) } as never,
    audit,
    invitations,
    tokens,
    members: members as never,
    directory,
    clock,
  });

  return { invite, accept, stored, sent, events, platformAdmins, tenantRoles, accounts };
}

const EMAILS = { emails: ['Admin@Example.org'], locale: 'en' } as const;

describe('mailing the platform administrators at start', () => {
  it('sends an address with no account one single-use link, for the platform scope', async () => {
    const { invite, sent, stored, events } = world();

    const outcome = (await invite.execute(EMAILS))._unsafeUnwrap();

    expect(outcome).toEqual({ invited: 1, skipped: 0, failed: 0 });
    expect(sent).toEqual([{ to: 'admin@example.org', token: 'token-1', locale: 'en' }]);
    const [invitation] = [...stored.values()];
    expect(invitation).toMatchObject({
      tenantId: PLATFORM_TENANT_ID,
      email: 'admin@example.org',
      role: PLATFORM_ADMIN_ROLE,
    });
    expect(events.map((event) => event.type)).toEqual(['invitation.created']);
    // Only the hash is kept, never the token that went into the mail.
    expect(JSON.stringify([...stored.values()])).not.toContain('"token-1"');
  });

  it('does nothing for an address that already has an account', async () => {
    const { invite, sent } = world({ accounts: ['admin@example.org'] });

    expect((await invite.execute(EMAILS))._unsafeUnwrap()).toEqual({
      invited: 0,
      skipped: 1,
      failed: 0,
    });
    expect(sent).toHaveLength(0);
  });

  it('does not mail again on a restart while the first link is still open', async () => {
    const { invite, sent } = world();

    await invite.execute(EMAILS);
    const second = (await invite.execute(EMAILS))._unsafeUnwrap();

    expect(second).toEqual({ invited: 0, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it('counts each address once, whatever its case or spacing', async () => {
    const { invite, sent } = world();

    const outcome = (
      await invite.execute({ emails: ['a@example.org', ' A@EXAMPLE.ORG ', ''], locale: 'en' })
    )._unsafeUnwrap();

    expect(outcome.invited).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('revokes a link nobody received, and reports the failure instead of throwing', async () => {
    const { invite, stored } = world({ mailFails: true });

    const outcome = (await invite.execute(EMAILS))._unsafeUnwrap();

    expect(outcome).toEqual({ invited: 0, skipped: 0, failed: 1 });
    expect(stored.size).toBe(0);
  });

  it('refuses an entry that is not an address, and goes on with the others', async () => {
    const { invite, sent } = world();

    const outcome = (
      await invite.execute({ emails: ['not-an-address', 'ok@example.org'], locale: 'en' })
    )._unsafeUnwrap();

    expect(outcome).toEqual({ invited: 1, skipped: 0, failed: 1 });
    expect(sent.map((message) => message.to)).toEqual(['ok@example.org']);
  });
});

describe('accepting a platform invitation', () => {
  async function invitedWorld() {
    const w = world();
    await w.invite.execute(EMAILS);
    return w;
  }

  it('creates the account and makes it a platform administrator', async () => {
    const { accept, platformAdmins, tenantRoles, accounts } = await invitedWorld();

    const result = await accept.execute({
      token: 'token-1',
      name: 'Marvin',
      password: 'a long enough passphrase 123',
    });

    expect(result.isOk()).toBe(true);
    expect(accounts.has('admin@example.org')).toBe(true);
    expect(platformAdmins.has(EXISTING)).toBe(true);
    expect(tenantRoles.size).toBe(0);
  });

  it('works once: the same link is refused afterwards', async () => {
    const { accept, platformAdmins } = await invitedWorld();
    const input = { token: 'token-1', name: 'Marvin', password: 'a long enough passphrase 123' };

    await accept.execute(input);
    platformAdmins.clear();
    const again = await accept.execute(input);

    expect(again._unsafeUnwrapErr().code).toBe(invalidToken().code);
    expect(platformAdmins.size).toBe(0);
  });

  it('refuses a platform-administrator invitation that sits in an ordinary tenant', async () => {
    const { accept, stored, platformAdmins } = await invitedWorld();
    const [only] = [...stored.values()];
    if (only === undefined) {
      throw new Error('no invitation was stored');
    }
    stored.set(only.id, { ...only, tenantId: toTenantId('some-website') });

    const result = await accept.execute({
      token: 'token-1',
      name: 'Marvin',
      password: 'a long enough passphrase 123',
    });

    expect(result.isErr()).toBe(true);
    expect(platformAdmins.size).toBe(0);
  });
});
