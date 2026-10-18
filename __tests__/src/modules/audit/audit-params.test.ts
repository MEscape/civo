import { describe, expect, it } from 'vitest';

import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';
import {
  auditParamsOf,
  parseAuditParams,
} from '@modules/audit/presentation/schemas/audit-filter-schema';

describe('the audit page address', () => {
  it('reads every filter', () => {
    const { filter, page } = parseAuditParams({
      website: 'site-1',
      area: 'booking',
      event: 'booking.confirmed',
      who: 'member:actor-1',
      period: '7d',
      warnings: '1',
      page: '2',
    });

    expect(filter).toEqual({
      websiteId: 'site-1',
      source: 'booking',
      type: 'booking.confirmed',
      actor: { kind: 'member', id: 'actor-1' },
      period: '7d',
      onlyWarnings: true,
    });
    expect(page.page).toBe('2');
  });

  it('falls back to no filter for anything hand-edited or repeated, and for the form’s "any"', () => {
    const { filter } = parseAuditParams({
      area: 'nowhere',
      event: 'any',
      who: 'any',
      period: ['7d', '30d'],
      warnings: 'yes',
    });

    expect(filter).toEqual(EMPTY_AUDIT_FILTER);
  });

  it('writes a filter back without its defaults, so the address stays short', () => {
    expect(auditParamsOf(EMPTY_AUDIT_FILTER)).toEqual({
      area: undefined,
      event: undefined,
      who: undefined,
      period: undefined,
      warnings: undefined,
    });
    const round = parseAuditParams(
      auditParamsOf({ ...EMPTY_AUDIT_FILTER, actor: { kind: 'system' }, period: 'all' }),
    );
    expect(round.filter.actor).toEqual({ kind: 'system' });
    expect(round.filter.period).toBe('all');
  });
});
