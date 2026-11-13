import { describe, expect, it, vi } from 'vitest';

import { toAuditEntry as ingestEvent } from '@modules/audit/domain/models/audit-trail-source';
import { toAuditEntry } from '@modules/audit/infrastructure/prisma/audit-trail-record-mapper';
import type { AuditEntryRecord } from '@modules/audit/infrastructure/prisma/audit-trail-record-mapper';

// This mapper needs only the real timestamp conversion, not a database connection or generated contract.
vi.mock('@lib/db', async () => import('@lib/db/temporal'));

const at = new Date('2026-10-29T12:00:00Z');
const record: AuditEntryRecord = {
  id: 'entry-a',
  websiteId: 'site-a',
  source: 'auth',
  type: 'changed',
  severity: 'INFO',
  actorKind: 'MEMBER',
  actorId: 'member-a',
  details: {},
  occurredAt: { epochMilliseconds: at.getTime() },
};

describe('audit persistence mapping', () => {
  it('accepts the same detail values when ingesting events and reading stored records', () => {
    const details = {
      text: 'changed',
      count: 0,
      enabled: false,
      absent: null,
      fields: ['name'],
      empty: [],
      nested: { secret: 'never' },
      mixed: ['name', 1],
      numbers: [1, 2],
    };
    const event = { type: 'changed', tenantId: 'site-a', actorId: 'member-a', ...details };
    const ingested = ingestEvent(
      event,
      {
        source: 'auth',
        levels: { changed: 'info' },
        policy: { changed: 'member' },
      },
      at,
    );
    const stored = toAuditEntry({ ...record, details });
    const expected = {
      text: 'changed',
      count: 0,
      enabled: false,
      absent: null,
      fields: ['name'],
      empty: [],
    };
    expect(ingested?.details).toEqual(expected);
    expect(stored?.details).toEqual(expected);
    expect(stored?.occurredAt).toEqual(at);
  });

  it('drops records from unknown sources', () => {
    expect(toAuditEntry({ ...record, source: 'unknown' })).toBeNull();
  });

  it.each([null, 'text', [], 1, { missing: undefined }])(
    'reads malformed stored details %j as empty',
    (details) => {
      expect(toAuditEntry({ ...record, details })?.details).toEqual({});
    },
  );

  it.each([
    { actorKind: 'MEMBER', actorId: null },
    { actorKind: 'UNKNOWN', actorId: 'member-a' },
    { actorKind: 'SYSTEM', actorId: 'member-a' },
  ])('keeps an entry with inconsistent actor data as a system entry', (actor) => {
    expect(toAuditEntry({ ...record, ...actor })?.actor).toEqual({ kind: 'system' });
  });
});
