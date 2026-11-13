import { describe, expect, it } from 'vitest';

import { GetAuditTrail } from '@modules/audit/application/queries/get-audit-trail';
import { GetAuditTrailAcrossWebsites } from '@modules/audit/application/queries/get-audit-trail-across-websites';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';
import type { UserAdministrationDependencies } from '@modules/auth/application/auth-dependencies';
import { AuthorizeWebsiteAccess } from '@modules/auth/application/queries/authorize-website-access';
import { ListAccessibleWebsites } from '@modules/auth/application/queries/list-accessible-websites';
import { AuthAuditAccess } from '@modules/auth/infrastructure/access/auth-audit-access';

import { infrastructureError, unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { TrailStore } from '../../../audit/support/trail-store';
import {
  SCOPE_IDS,
  userManagementScopeWorld,
} from '../../application/support/user-management-scope-world';

function world(options: Parameters<typeof userManagementScopeWorld>[0] = {}) {
  const source = userManagementScopeWorld(options);
  const deps: UserAdministrationDependencies = source.deps;
  const { roster } = source;
  const access = new AuthAuditAccess(() => ({
    authorizeWebsiteAccess: new AuthorizeWebsiteAccess(deps),
    listAccessibleWebsites: new ListAccessibleWebsites(deps),
  }));
  const entries = new TrailStore();
  const readDependencies = { access, entries, clock: deps.clock };
  return {
    deps,
    roster,
    entries,
    trail: new GetAuditTrail(readDependencies),
    across: new GetAuditTrailAcrossWebsites(readDependencies),
  };
}

describe('auth permissions integrated with audit reads', () => {
  it('reads a separately authorized website regardless of the website currently open', async () => {
    const { trail, entries } = world();
    expect((await trail.execute(SCOPE_IDS.b, EMPTY_AUDIT_FILTER)).isOk()).toBe(true);
    expect(entries.reads).toHaveLength(3);
    expect(entries.reads).toEqual(Array(3).fill({ kind: 'website', websiteId: SCOPE_IDS.b }));
  });

  it('refuses website readers without audit.read before any trail or facet read', async () => {
    const { trail, entries } = world();
    const result = await trail.execute(SCOPE_IDS.c, EMPTY_AUDIT_FILTER);
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(entries.reads).toEqual([]);
  });

  it('applies the same membership allowlist to the page and both facets', async () => {
    const { across, entries } = world();
    const result = await across.execute(EMPTY_AUDIT_FILTER);
    expect(result._unsafeUnwrap().reach).toBe('websites');
    expect(entries.reads).toEqual(
      Array(3).fill({ kind: 'websites', websiteIds: [SCOPE_IDS.a, SCOPE_IDS.b] }),
    );
  });

  it('uses platform scope only for current platform authority', async () => {
    const { across, entries } = world({ platform: true });
    expect((await across.execute(EMPTY_AUDIT_FILTER))._unsafeUnwrap().reach).toBe('platform');
    expect(entries.reads).toEqual(Array(3).fill({ kind: 'platform' }));
  });

  it('rechecks membership changes through already constructed readers', async () => {
    const { trail, roster, entries } = world();
    expect((await trail.execute(SCOPE_IDS.b, EMPTY_AUDIT_FILTER)).isOk()).toBe(true);
    entries.reads.length = 0;
    roster.get(SCOPE_IDS.b)?.set(SCOPE_IDS.manager, ['viewer']);
    expect((await trail.execute(SCOPE_IDS.b, EMPTY_AUDIT_FILTER))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
    expect(entries.reads).toEqual([]);
  });

  it('refuses a platform read of a website that does not exist', async () => {
    const { trail, deps, entries } = world({ platform: true });
    deps.tenants.exists = () => okAsync(false);
    expect((await trail.execute('missing', EMPTY_AUDIT_FILTER))._unsafeUnwrapErr().kind).toBe(
      'forbidden',
    );
    expect(entries.reads).toEqual([]);
  });

  it('propagates identity infrastructure failures without reading audit data', async () => {
    const { across, deps, entries } = world();
    const failure = infrastructureError('auth.unavailable', 'Unavailable', null);
    deps.authorization.requireActor = () => errAsync(failure);
    expect((await across.execute(EMPTY_AUDIT_FILTER))._unsafeUnwrapErr()).toBe(failure);
    expect(entries.reads).toEqual([]);
  });

  it('propagates signed-out failures without reading audit data', async () => {
    const { trail, deps, entries } = world();
    const failure = unauthorizedError('auth.unauthorized', 'Sign in');
    deps.authorization.requireActor = () => errAsync(failure);
    expect((await trail.execute(SCOPE_IDS.a, EMPTY_AUDIT_FILTER))._unsafeUnwrapErr()).toBe(failure);
    expect(entries.reads).toEqual([]);
  });

  it('keeps a truncated allowlist narrow but authorizes an explicit omitted website independently', async () => {
    const { across, deps, entries } = world();
    deps.members.findTenantIdsWithRoles = () =>
      okAsync({ tenantIds: [SCOPE_IDS.a], isTruncated: true });
    const all = await across.execute(EMPTY_AUDIT_FILTER);
    expect(all._unsafeUnwrap().isWebsitesTruncated).toBe(true);
    expect(entries.reads).toEqual(Array(3).fill({ kind: 'websites', websiteIds: [SCOPE_IDS.a] }));
    entries.reads.length = 0;
    const narrowed = await across.execute({ ...EMPTY_AUDIT_FILTER, websiteId: SCOPE_IDS.b });
    expect(narrowed.isOk()).toBe(true);
    expect(entries.reads).toEqual(Array(3).fill({ kind: 'website', websiteId: SCOPE_IDS.b }));
  });
});
