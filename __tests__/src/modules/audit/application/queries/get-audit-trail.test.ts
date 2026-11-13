import { describe, expect, it } from 'vitest';

import { GetAuditTrail } from '@modules/audit/application/queries/get-audit-trail';
import { auditAccessDenied } from '@modules/audit/domain/errors/audit-errors';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';

import { errAsync } from '@lib/result';

import { NOW, clock, store } from '../support/audit-world';

describe('reading a trail', () => {
  it('resolves the period to an instant before now and passes every filter on', async () => {
    const { entries, access, asked } = store();
    const trail = await new GetAuditTrail({ entries, access, clock }).execute('site-1', {
      ...EMPTY_AUDIT_FILTER,
      source: 'booking',
      period: '7d',
      onlyWarnings: true,
      actor: { kind: 'visitor' },
    });

    expect(trail.isOk()).toBe(true);
    expect(asked[0]).toEqual({
      source: 'booking',
      type: null,
      actor: { kind: 'visitor' },
      since: new Date('2026-10-09T12:00:00Z'),
      onlyWarnings: true,
    });
    expect(trail._unsafeUnwrap().types).toHaveLength(1);
    expect(trail._unsafeUnwrap().isTypesTruncated).toBe(false);
    expect(trail._unsafeUnwrap().readAt).toEqual(NOW);
  });

  it('refuses access when the user is not authorized for the website', async () => {
    const { entries, access, asked } = store({
      authorizeWebsite: () => errAsync(auditAccessDenied()),
    });
    const trail = await new GetAuditTrail({ entries, access, clock }).execute(
      'site-foreign',
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isErr()).toBe(true);
    expect(trail._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(asked).toHaveLength(0);
  });

  it('reports isTypesTruncated and isMembersTruncated when counts hit limit', async () => {
    const { entries, access } = store({
      countByTypeTruncated: true,
      listMemberIdsTruncated: true,
    });
    const trail = await new GetAuditTrail({ entries, access, clock }).execute(
      'site-1',
      EMPTY_AUDIT_FILTER,
    );

    expect(trail.isOk()).toBe(true);
    expect(trail._unsafeUnwrap().isTypesTruncated).toBe(true);
    expect(trail._unsafeUnwrap().isMembersTruncated).toBe(true);
  });

  it('refuses a member id from the address that cannot be one', async () => {
    const { entries, access, asked } = store();
    const trail = await new GetAuditTrail({ entries, access, clock }).execute('site-1', {
      ...EMPTY_AUDIT_FILTER,
      actor: { kind: 'member', id: '' },
    });

    expect(trail._unsafeUnwrapErr().kind).toBe('validation');
    expect(asked).toHaveLength(0);
  });
});
