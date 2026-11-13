import { describe, expect, it } from 'vitest';

import { GetAuditTrail } from '@modules/audit/application/queries/get-audit-trail';
import { GetAuditTrailAcrossWebsites } from '@modules/audit/application/queries/get-audit-trail-across-websites';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';

import { clock, store } from '../support/audit-world';

describe('which websites a trail covers', () => {
  it('reads one website, the one named', async () => {
    const { entries, access, scopes } = store();

    await new GetAuditTrail({ entries, access, clock }).execute('site-1', EMPTY_AUDIT_FILTER);

    expect(scopes).toEqual([{ kind: 'website', websiteId: 'site-1' }]);
  });

  it.each(['', 'x'.repeat(129)])(
    'never falls back to every website for the id %j: it is refused, and nothing is read',
    async (rawId) => {
      const { entries, access, scopes } = store();

      const trail = await new GetAuditTrail({ entries, access, clock }).execute(
        rawId,
        EMPTY_AUDIT_FILTER,
      );

      expect(trail._unsafeUnwrapErr().kind).toBe('validation');
      expect(scopes).toEqual([]);
    },
  );

  it('reads platform-wide when user is platform admin and no website is filtered', async () => {
    const { entries, access, scopes } = store({
      accessibleWebsites: {
        isPlatform: true,
        websites: [
          { id: 'site-1', name: 'Alpha' },
          { id: 'site-2', name: 'Beta' },
        ],
        isTruncated: false,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute(
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isOk()).toBe(true);
    expect(scopes).toEqual([{ kind: 'platform' }]);
    expect(trail._unsafeUnwrap().reach).toBe('platform');
    expect(trail._unsafeUnwrap().websites).toHaveLength(2);
  });

  it('scopes to named allowlist when user manages multiple websites', async () => {
    const { entries, access, scopes } = store({
      accessibleWebsites: {
        isPlatform: false,
        websites: [
          { id: 'site-1', name: 'Alpha' },
          { id: 'site-2', name: 'Beta' },
        ],
        isTruncated: false,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute(
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isOk()).toBe(true);
    expect(scopes).toEqual([{ kind: 'websites', websiteIds: ['site-1', 'site-2'] }]);
    expect(trail._unsafeUnwrap().reach).toBe('websites');
  });

  it('narrows the read to one authorized website when specified in filter', async () => {
    const { entries, access, scopes } = store({
      accessibleWebsites: {
        isPlatform: false,
        websites: [
          { id: 'site-1', name: 'Alpha' },
          { id: 'site-2', name: 'Beta' },
        ],
        isTruncated: false,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute({
      ...EMPTY_AUDIT_FILTER,
      websiteId: 'site-2',
    });

    expect(trail.isOk()).toBe(true);
    expect(scopes).toEqual([{ kind: 'website', websiteId: 'site-2' }]);
  });

  it('denies access when user tries to filter for an unauthorized website', async () => {
    const { entries, access, scopes } = store({
      accessibleWebsites: {
        isPlatform: false,
        websites: [{ id: 'site-1', name: 'Alpha' }],
        isTruncated: false,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute({
      ...EMPTY_AUDIT_FILTER,
      websiteId: 'site-forbidden',
    });

    expect(trail.isErr()).toBe(true);
    expect(trail._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(scopes).toHaveLength(0);
  });

  it('denies access across websites when user has no readable websites', async () => {
    const { entries, access, scopes } = store({
      accessibleWebsites: {
        isPlatform: false,
        websites: [],
        isTruncated: false,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute(
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isErr()).toBe(true);
    expect(trail._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(scopes).toHaveLength(0);
  });

  it('reports isWebsitesTruncated when accessible websites list is truncated', async () => {
    const { entries, access } = store({
      accessibleWebsites: {
        isPlatform: true,
        websites: [{ id: 'site-1', name: 'Alpha' }],
        isTruncated: true,
      },
    });

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute(
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isOk()).toBe(true);
    expect(trail._unsafeUnwrap().isWebsitesTruncated).toBe(true);
  });

  it('refuses a malformed website in the filter instead of widening to all of them', async () => {
    const { entries, access, scopes } = store();

    const trail = await new GetAuditTrailAcrossWebsites({ entries, access, clock }).execute({
      ...EMPTY_AUDIT_FILTER,
      websiteId: '',
    });

    expect(trail._unsafeUnwrapErr().kind).toBe('validation');
    expect(scopes).toEqual([]);
  });
});
