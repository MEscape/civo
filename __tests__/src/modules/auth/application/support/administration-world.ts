import type { InviteUserDependencies } from '@modules/auth/application/auth-dependencies';
import { AcceptInvitation } from '@modules/auth/application/commands/accept-invitation';
import { permissionDenied, unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toInvitationId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId } from '@modules/auth/domain/models/ids';
import type { Invitation } from '@modules/auth/domain/models/invitation';
import type { Role, TenantRole } from '@modules/auth/domain/models/role';
import type {
  InvitationRepository,
  NewInvitation,
} from '@modules/auth/domain/ports/invitation.repository';
import type { MembershipRepository } from '@modules/auth/domain/ports/membership.repository';
import type { UserDirectory } from '@modules/auth/domain/ports/user-directory.port';

import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { clientAt, createTestRateLimiter } from '../../../../support/rate-limiting';

const TENANT = toTenantId('default');
const ADMIN = toActorId('admin-1');
const NOW = new Date('2026-10-11T10:00:00Z');

/** Everything the administration use cases touch, in memory. */
export function administrationWorld(options: { readonly actorRoles?: readonly Role[] } = {}) {
  const roles = new Map<ActorId, TenantRole[]>([
    [ADMIN, ['admin']],
    [toActorId('editor-1'), ['editor']],
    [toActorId('admin-2'), ['admin']],
  ]);
  const invitations = new Map<string, Invitation & { tokenHash: string }>();
  const accounts = new Map<string, ActorId>([['known@example.org', toActorId('known-1')]]);
  const sent: Array<{ to: string; token: string }> = [];
  const audit: string[] = [];
  const auditEvents: Array<{ type: string } & Record<string, unknown>> = [];
  const recordAudit = (event: { type: string }) => {
    audit.push(event.type);
    auditEvents.push(event);
  };
  const actorRoles = options.actorRoles ?? ['admin'];
  roles.set(
    ADMIN,
    actorRoles.filter((role): role is TenantRole => role !== 'platform_admin'),
  );
  const platformAdmins = new Set<ActorId>(actorRoles.includes('platform_admin') ? [ADMIN] : []);
  const session: { actorId: ActorId | null } = { actorId: null };
  const unverifiedEmails = new Set<string>();
  const websites = new Set<string>([TENANT, 'other-site']);
  const faults = {
    mail: false,
    signUp: false,
    grant: false,
    release: false,
    directory: false,
    tenant: false,
    invitation: false,
    revoke: false,
  };
  const foreignRoles = new Map<string, TenantRole[]>();
  const failed = (code: string) => errAsync(infrastructureError(code, 'unavailable'));

  const authorization = {
    requireActor: () => okAsync({ id: ADMIN, tenantId: TENANT, roles: actorRoles }),
    requireInTenant: (permission: Parameters<typeof decide>[1]) => {
      const actor = { id: ADMIN, tenantId: TENANT, roles: actorRoles };
      return decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied());
    },
    requireOnResource: () => errAsync(permissionDenied()),
  };

  function replaceKeepingAdministrator(id: ActorId, next: readonly TenantRole[]): boolean {
    const administrators = [...roles.values()].filter((held) => held.includes('admin')).length;
    const isLastAdministrator = roles.get(id)?.includes('admin') === true && administrators <= 1;
    if (isLastAdministrator && !next.includes('admin')) {
      return false;
    }
    if (next.length === 0) {
      roles.delete(id);
    } else {
      roles.set(id, [...next]);
    }
    return true;
  }

  const members: MembershipRepository = {
    isPlatformAdmin: (id) => okAsync(platformAdmins.has(id)),
    grantPlatformAdmin: (id) => {
      platformAdmins.add(id);
      return okAsync(true);
    },
    revokePlatformAdmin: () => okAsync(true),
    listPlatformAdmins: () => okAsync({ ids: [], isTruncated: false }),
    findTenantIdsWithRoles: (id, wanted) =>
      okAsync({
        tenantIds: [
          ...((roles.get(id) ?? []).some((role) => wanted.includes(role)) ? [TENANT] : []),
          ...[...foreignRoles]
            .filter(
              ([key, foreign]) =>
                key.endsWith(`:${id}`) && foreign.some((role) => wanted.includes(role)),
            )
            .map(([key]) => toTenantId(key.slice(0, -(id.length + 1)))),
        ],
        isTruncated: false,
      }),
    findFirstTenant: () => okAsync(TENANT),
    findMemberIds: () => okAsync({ ids: [...roles.keys()], isTruncated: false }),
    listMembershipsOf: (actorIds, tenantIds) =>
      okAsync(
        new Map(
          actorIds.flatMap((id) => {
            const own = roles.get(id) ?? [];
            const held = [
              ...(own.length > 0 ? [{ tenantId: TENANT, roles: own }] : []),
              ...[...foreignRoles]
                .filter(([key, foreign]) => key.endsWith(`:${id}`) && foreign.length > 0)
                .map(([key, foreign]) => ({
                  tenantId: toTenantId(key.slice(0, -(id.length + 1))),
                  roles: foreign,
                })),
            ].filter(
              (membership) => tenantIds === undefined || tenantIds.includes(membership.tenantId),
            );
            return held.length === 0 ? [] : [[id, held] as const];
          }),
        ),
      ),
    countMembers: () => okAsync({ members: roles.size, byRole: new Map() }),
    findRoles: (id: ActorId, tenantId) =>
      okAsync(
        tenantId === TENANT ? (roles.get(id) ?? []) : (foreignRoles.get(`${tenantId}:${id}`) ?? []),
      ),
    listMembers: () => okAsync({ members: new Map(roles), isTruncated: false }),
    grantRole: (id, tenantId, role) => {
      if (faults.grant) {
        return failed('auth.grant_failed');
      }
      if (tenantId === TENANT) {
        roles.set(id, [...new Set([...(roles.get(id) ?? []), role])]);
      } else {
        const key = `${tenantId}:${id}`;
        foreignRoles.set(key, [...new Set([...(foreignRoles.get(key) ?? []), role])]);
      }
      return okAsync(undefined);
    },
    // The real repository does this count and the write in one locked transaction.
    replaceRolesKeepingAdministrator: (id: ActorId, _t: unknown, input) =>
      okAsync(replaceKeepingAdministrator(id, input.roles)),
    removeMemberKeepingAdministrator: (id: ActorId) => okAsync(replaceKeepingAdministrator(id, [])),
  };

  const hashed = (token: string) => `hash:${token}`;
  let counter = 0;
  function storeInvitation(draft: NewInvitation) {
    counter += 1;
    const invitation = {
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
    invitations.set(invitation.id, invitation);
    return okAsync(invitation);
  }

  function hasInvitationAuthority(entry: Invitation, isBootstrap: boolean): boolean {
    if (isBootstrap || platformAdmins.has(entry.invitedBy)) {
      return true;
    }
    if (entry.role === 'platform_admin') {
      return false;
    }
    const held =
      entry.tenantId === TENANT
        ? roles.get(entry.invitedBy)
        : foreignRoles.get(`${entry.tenantId}:${entry.invitedBy}`);
    return held?.includes('admin') === true;
  }
  function holdsAccess(entry: Invitation, actorId: ActorId): boolean {
    if (entry.role === 'platform_admin') {
      return platformAdmins.has(actorId);
    }
    const held =
      entry.tenantId === TENANT
        ? roles.get(actorId)
        : foreignRoles.get(`${entry.tenantId}:${actorId}`);
    return (held ?? []).length > 0;
  }
  function grantAcceptedRole(entry: Invitation, actorId: ActorId): void {
    if (entry.role === 'platform_admin') {
      platformAdmins.add(actorId);
      return;
    }
    if (entry.tenantId === TENANT) {
      if ((roles.get(actorId) ?? []).length === 0) {
        roles.set(actorId, [entry.role]);
      }
      return;
    }
    const key = `${entry.tenantId}:${actorId}`;
    if ((foreignRoles.get(key) ?? []).length === 0) {
      foreignRoles.set(key, [entry.role]);
    }
  }

  const repository: InvitationRepository = {
    hasOpenForEmail: (tenantId, email, now) =>
      okAsync(
        [...invitations.values()].some(
          (entry) =>
            entry.tenantId === tenantId &&
            entry.email === email &&
            entry.acceptedAt === null &&
            entry.expiresAt > now,
        ),
      ),
    createPending: (draft, now) => {
      const pending = [...invitations.values()].some(
        (entry) =>
          entry.tenantId === draft.tenantId &&
          entry.email === draft.email &&
          entry.acceptedAt === null &&
          entry.expiresAt > now,
      );
      return pending ? okAsync(null) : storeInvitation(draft);
    },
    accept: ({ id, actorId, now, bootstrapAuthority }) => {
      const entry = invitations.get(id);
      if (entry === undefined) {
        return okAsync('unavailable');
      }
      // A consumed offer is idempotent only for an account that still holds access in its scope.
      if (entry.acceptedAt !== null) {
        return okAsync(holdsAccess(entry, actorId) ? 'already_member' : 'unavailable');
      }
      if (entry.expiresAt <= now) {
        return okAsync('unavailable');
      }
      if (entry.role !== 'platform_admin' && !websites.has(entry.tenantId)) {
        return okAsync('unavailable');
      }
      if (!hasInvitationAuthority(entry, bootstrapAuthority)) {
        return okAsync('unavailable');
      }
      if (faults.grant) {
        return failed('auth.grant_failed');
      }
      const wasMember = holdsAccess(entry, actorId);
      grantAcceptedRole(entry, actorId);
      invitations.set(id, { ...entry, acceptedAt: now });
      return okAsync(wasMember ? 'already_member' : 'accepted');
    },
    countOpen: () => okAsync(0),
    findByTokenHash: (hash: string) =>
      faults.invitation
        ? failed('auth.invitation_lookup_failed')
        : okAsync([...invitations.values()].find((entry) => entry.tokenHash === hash) ?? null),
    listOpenForTenants: (tenantIds, now, page) => {
      const entries = [...invitations.values()].filter(
        (entry) =>
          (tenantIds === null || tenantIds.includes(entry.tenantId)) &&
          entry.acceptedAt === null &&
          entry.expiresAt > now,
      );
      const start = (page.page - 1) * page.pageSize;
      return okAsync(toPage(entries.slice(start, start + page.pageSize), entries.length, page));
    },
    revoke: (id: string) =>
      faults.revoke ? failed('auth.revoke_failed') : okAsync(invitations.delete(id)),
  };

  let tokenCounter = 0;
  const tokens = {
    issue: () => {
      tokenCounter += 1;
      const token = `token-${tokenCounter}`;
      return { token, hash: hashed(token) };
    },
    hash: hashed,
  };

  const directory = {
    search: ((query) => {
      const identities = new Map([
        ...['admin-1', 'admin-2', 'admin-3', 'editor-1'].map(
          (id) => [toActorId(id), `${id}@example.org`] as const,
        ),
        ...[...accounts].map(([email, id]) => [id, email] as const),
      ]);
      const found = [...identities]
        .filter(([id]) => query.ids === null || query.ids.includes(id))
        .map(([id, email]) => ({
          id,
          email,
          name: 'N',
          emailVerified: !unverifiedEmails.has(email),
          createdAt: NOW,
        }));
      return okAsync(toPage(found.slice(0, query.page.pageSize), found.length, query.page));
    }) satisfies UserDirectory['search'],
    findByEmail: (email: string) => {
      if (faults.directory) {
        return failed('auth.directory_failed');
      }
      const id = accounts.get(email);
      return okAsync(
        id === undefined
          ? null
          : { id, email, name: 'N', emailVerified: !unverifiedEmails.has(email), createdAt: NOW },
      );
    },
  };

  const mailer = {
    sendPasswordReset: () => okAsync(undefined),
    sendVerification: () => okAsync(undefined),
    sendExistingAccountNotice: () => okAsync(undefined),
    sendInvitation: (message: { to: string; token: string }) => {
      if (faults.mail) {
        return failed('auth.mail_delivery_failed');
      }
      sent.push({ to: message.to, token: message.token });
      return okAsync(undefined);
    },
  };

  const deps = {
    authorization,
    rateLimiter: createTestRateLimiter(),
    members,
    directory,
    invitations: repository,
    tokens,
    mailer,
    audit: { record: recordAudit },
    clock: { now: () => NOW },
    tenants: {
      exists: (tenantId) =>
        faults.tenant ? failed('auth.tenant_failed') : okAsync(websites.has(tenantId)),
      findName: (tenantId) => okAsync(websites.has(tenantId) ? 'Website' : null),
      listNames: () =>
        okAsync({
          websites: [...websites].map((id) => ({ id: toTenantId(id), name: 'Website' })),
          isTruncated: false,
        }),
    },
  } satisfies InviteUserDependencies;

  const authenticator = {
    signIn: () => okAsync(undefined),
    signOut: () => okAsync(undefined),
    requestPasswordReset: () => okAsync(undefined),
    resetPassword: () => okAsync(undefined),
    signUp: (draft: { email: string }) => {
      if (faults.signUp) {
        return failed('auth.provider_failed');
      }
      if (!accounts.has(draft.email)) {
        accounts.set(draft.email, toActorId(`new-${accounts.size}`));
        unverifiedEmails.add(draft.email);
      }
      return okAsync(undefined);
    },
  };
  const acceptDependencies = {
    authenticator,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
    audit: { record: recordAudit },
    invitations: repository,
    tokens,
    members,
    directory,
    clock: { now: () => NOW },
    tenants: deps.tenants,
    bootstrapAdminEmails: new Set<string>(),
    currentActor: {
      getCurrentActor: () =>
        session.actorId === null
          ? errAsync(unauthenticated())
          : okAsync({ id: session.actorId, tenantId: TENANT, roles: [] }),
    },
  };
  const accept = new AcceptInvitation(acceptDependencies);

  return {
    deps,
    roles,
    accounts,
    sent,
    audit,
    auditEvents,
    accept,
    invitations,
    faults,
    websites,
    foreignRoles,
    acceptDependencies,
    session,
    platformAdmins,
    unverifiedEmails,
    authenticate: (email: string) => {
      session.actorId = accounts.get(email) ?? null;
      unverifiedEmails.delete(email);
    },
  };
}
