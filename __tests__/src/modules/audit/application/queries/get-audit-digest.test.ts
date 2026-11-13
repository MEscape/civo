import { describe, expect, it } from 'vitest';

import { GetAuditDigest } from '@modules/audit/application/queries/get-audit-digest';
import { auditAccessDenied } from '@modules/audit/domain/errors/audit-errors';

import { errAsync } from '@lib/result';

import { clock, store } from '../support/audit-world';

describe('the overview digest', () => {
  it('has every day of the month, quiet days as zero, and totals them', async () => {
    const { entries, access } = store();
    const digest = (
      await new GetAuditDigest({ entries, access, clock }).execute('site-1')
    )._unsafeUnwrap();

    expect(digest.days).toHaveLength(30);
    expect(digest.days[0]?.day).toBe('2026-09-17');
    expect(digest.days.at(-1)?.day).toBe('2026-10-16');
    expect(digest.days.find((day) => day.day === '2026-10-15')).toEqual({
      day: '2026-10-15',
      total: 4,
      warnings: 1,
    });
    expect(digest.total).toBe(4);
    expect(digest.warnings).toBe(1);
  });

  it('refuses access when user is not authorized for the website', async () => {
    const { entries, access } = store({
      authorizeWebsite: () => errAsync(auditAccessDenied()),
    });
    const result = await new GetAuditDigest({ entries, access, clock }).execute('site-foreign');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});
