import { describe, expect, it } from 'vitest';

import { PruneAuditTrail } from '@modules/audit/application/commands/prune-audit-trail';

import { clock, store } from '../support/audit-world';

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
