import { describe, expect, it } from 'vitest';

import { PruneAuditTrail } from '@modules/audit/application/commands/prune-audit-trail';
import { GetAuditDigest } from '@modules/audit/application/queries/get-audit-digest';
import { GetAuditTrail } from '@modules/audit/application/queries/get-audit-trail';
import { AuditTrailRecorder } from '@modules/audit/application/services/audit-trail-recorder';
import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';
import type {
  AuditCriteria,
  AuditTrailRepository,
} from '@modules/audit/domain/ports/audit-trail.repository';

import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

const NOW = new Date('2026-10-16T12:00:00Z');
const clock = { now: () => NOW };

function store(options: { readonly failAppend?: boolean } = {}) {
  const appended: NewAuditEntry[] = [];
  const asked: AuditCriteria[] = [];
  const cutoffs: Date[] = [];
  const entries: AuditTrailRepository = {
    append: (entry) => {
      if (options.failAppend === true) {
        return errAsync(infrastructureError('audit.persistence_failed', 'down', null));
      }
      appended.push(entry);
      return okAsync(undefined);
    },
    list: (_websiteId, criteria, page) => {
      asked.push(criteria);
      return okAsync(toPage([], 0, page));
    },
    countByType: () => okAsync([{ source: 'booking', type: 'booking.confirmed', count: 2 }]),
    listMemberIds: () => okAsync({ items: [], isTruncated: false }),
    countPerDay: () => okAsync([{ day: '2026-10-15', total: 4, warnings: 1 }]),
    deleteOlderThan: (cutoff) => {
      cutoffs.push(cutoff);
      return okAsync(7);
    },
  };
  return { entries, appended, asked, cutoffs };
}

describe('reading a trail', () => {
  it('resolves the period to an instant before now and passes every filter on', async () => {
    const { entries, asked } = store();
    const trail = await new GetAuditTrail({ entries, clock }).execute('site-1', {
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
    // The period and "5 minutes ago" are measured from the same instant.
    expect(trail._unsafeUnwrap().readAt).toEqual(NOW);
  });

  it('refuses a member id from the address that cannot be one', async () => {
    const { entries, asked } = store();
    const trail = await new GetAuditTrail({ entries, clock }).execute('site-1', {
      ...EMPTY_AUDIT_FILTER,
      actor: { kind: 'member', id: '' },
    });

    expect(trail._unsafeUnwrapErr().kind).toBe('validation');
    expect(asked).toHaveLength(0);
  });
});

describe('recording into a trail', () => {
  const source = {
    source: 'website',
    levels: { 'website.updated': 'info' },
    policy: { 'website.updated': 'member' },
  } as const;
  const updated: { readonly type: 'website.updated' } = {
    type: 'website.updated',
    ...{ tenantId: 'site-1', actorId: 'actor-1' },
  };

  it('writes the entry with the clock’s time', async () => {
    const { entries, appended } = store();
    new AuditTrailRecorder({ entries, clock }).record(updated, source);
    await Promise.resolve();

    expect(appended).toHaveLength(1);
    expect(appended[0]?.occurredAt).toEqual(NOW);
  });

  it('never fails the caller when the store does', () => {
    const { entries } = store({ failAppend: true });

    expect(() => {
      new AuditTrailRecorder({ entries, clock }).record(updated, source);
    }).not.toThrow();
  });
});

describe('keeping a trail to its retention', () => {
  it('deletes what happened before the retention began and logs how much went', async () => {
    const { entries, cutoffs } = store();
    const logged: unknown[] = [];
    const deleted = await new PruneAuditTrail({
      entries,
      clock,
      retentionDays: 30,
      audit: { record: (event) => logged.push(event) },
    }).execute();

    expect(deleted._unsafeUnwrap()).toBe(7);
    expect(cutoffs).toEqual([new Date('2026-09-16T12:00:00Z')]);
    expect(logged).toEqual([{ type: 'audit.pruned', deletedCount: 7, retentionDays: 30 }]);
  });
});

describe('the overview digest', () => {
  it('has every day of the month, quiet days as zero, and totals them', async () => {
    const { entries } = store();
    const digest = (await new GetAuditDigest({ entries, clock }).execute('site-1'))._unsafeUnwrap();

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
});
