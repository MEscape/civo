import { describe, expect, it } from 'vitest';

import { AuditTrailRecorder } from '@modules/audit/application/services/audit-trail-recorder';
import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';

import { okAsync } from '@lib/result';

import { NOW, clock, store } from '../support/audit-world';

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
    const { entries } = store();
    const appended: NewAuditEntry[] = [];
    entries.append = (entry) => {
      appended.push(entry);
      return okAsync(undefined);
    };

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
