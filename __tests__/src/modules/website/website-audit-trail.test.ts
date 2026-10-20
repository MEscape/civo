import { describe, expect, it } from 'vitest';

import { EMPTY_AUDIT_FILTER } from '@modules/audit';
import type { AuditTrailView } from '@modules/audit';
import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, AuthorizationService } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { TenantRole } from '@modules/auth/domain/models/role';
import { GetPlatformAuditTrail } from '@modules/website/application/queries/get-platform-audit-trail';
import { GetWebsiteAuditTrail } from '@modules/website/application/queries/get-website-audit-trail';
import type { AuditTrailReader } from '@modules/website/domain/ports/audit-trail-reader.port';
import type { WebsiteRepository } from '@modules/website/domain/ports/website.repository';

import { forbiddenError, infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const denied = () => errAsync(forbiddenError('auth.permission_denied', 'Not allowed.'));

/** The real rule shape: the permission, and for a loaded resource also the tenant it is stored under. */
const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireInTenant: (permission) =>
    actorHasPermission(actor, permission) ? okAsync(actor) : denied(),
  requireOnResource: (permission, resource) =>
    actorHasPermission(actor, permission) && resource.tenantId === actor.tenantId
      ? okAsync(actor)
      : denied(),
});

const actorOf = (role: TenantRole, tenant = 'site-1'): Actor => ({
  id: toActorId(`actor-${role}`),
  tenantId: toTenantId(tenant),
  roles: [role],
});

/** One website per tenant; a lookup outside the actor's tenant finds nothing, like the real store. */
const websites = {
  findById: (id: string, tenantId: string) =>
    okAsync(id === tenantId ? ({ id, tenantId, name: id, slug: id } as never) : null),
} as unknown as WebsiteRepository;

function run(actor: Actor, websiteId = 'site-1') {
  const read: string[] = [];
  const trail: AuditTrailView = {
    entries: toPage([], 0, { page: 1, pageSize: 25 }),
    types: [],
    memberIds: [],
    isMembersTruncated: false,
    readAt: new Date(0),
  };
  const auditTrail: AuditTrailReader = {
    read: (id) => {
      read.push(id);
      return okAsync(trail);
    },
    readAcrossWebsites: () => {
      read.push('all');
      return okAsync(trail);
    },
    digest: () => errAsync(infrastructureError('unused', 'unused', null)),
  };
  const result = new GetWebsiteAuditTrail({
    authorization: authorizationFor(actor),
    websites,
    audit: { record: () => undefined },
    auditTrail,
  }).execute(websiteId, EMPTY_AUDIT_FILTER);
  return { result, read };
}

describe("reading a website's audit trail", () => {
  it('is an administrator’s, and reads the trail of the website it loaded', async () => {
    const { result, read } = run(actorOf('admin'));

    expect((await result).isOk()).toBe(true);
    expect(read).toEqual(['site-1']);
  });

  it.each(['editor', 'contributor', 'viewer', 'employee'] as const)(
    'is refused to a %s before the trail is read',
    async (role) => {
      const { result, read } = run(actorOf(role));

      expect((await result)._unsafeUnwrapErr().kind).toBe('forbidden');
      expect(read).toEqual([]);
    },
  );

  it('finds no other tenant’s website, so its trail is never read', async () => {
    const { result, read } = run(actorOf('admin'), 'site-2');

    expect((await result)._unsafeUnwrapErr().kind).toBe('not_found');
    expect(read).toEqual([]);
  });
});

describe("reading every website's audit trail", () => {
  const platformAdmin: Actor = {
    id: toActorId('actor-platform'),
    tenantId: toTenantId('platform'),
    roles: ['platform_admin'],
  };

  function runPlatform(actor: Actor) {
    const reads: string[] = [];
    const auditTrail: AuditTrailReader = {
      read: (id) => {
        reads.push(`website:${id}`);
        return okAsync({} as AuditTrailView);
      },
      readAcrossWebsites: () => {
        reads.push('across');
        return okAsync({} as AuditTrailView);
      },
      digest: () => errAsync(infrastructureError('unused', 'unused', null)),
    };
    const result = new GetPlatformAuditTrail({
      authorization: authorizationFor(actor),
      websites,
      audit: { record: () => undefined },
      auditTrail,
    }).execute(EMPTY_AUDIT_FILTER);
    return { result, reads };
  }

  it('is the platform administrator’s, and reads across the websites by asking for exactly that', async () => {
    const { result, reads } = runPlatform(platformAdmin);

    expect((await result).isOk()).toBe(true);
    expect(reads).toEqual(['across']);
  });

  it.each(['admin', 'editor', 'viewer'] as const)(
    'is refused to a website’s %s before any trail is read, however its own website is named',
    async (role) => {
      const { result, reads } = runPlatform(actorOf(role));

      expect((await result)._unsafeUnwrapErr().kind).toBe('forbidden');
      expect(reads).toEqual([]);
    },
  );
});
