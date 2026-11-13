import { describe, expect, it } from 'vitest';

import { toAuditEntry } from '@modules/audit/domain/models/audit-trail-source';
import type { AuditTrailSource } from '@modules/audit/domain/models/audit-trail-source';

type EventName = 'thing.changed' | 'thing.booked' | 'thing.swept' | 'thing.refused';

const SOURCE: AuditTrailSource<EventName> = {
  source: 'booking',
  levels: {
    'thing.changed': 'info',
    'thing.booked': 'info',
    'thing.swept': 'info',
    'thing.refused': 'warn',
  },
  policy: {
    'thing.changed': 'member',
    'thing.booked': 'visitor',
    'thing.swept': false,
    'thing.refused': 'member',
  },
  isWebsite: (id) => id !== 'platform',
};

const AT = new Date('2026-10-16T08:00:00Z');

/** A module event as the port receives it: a type and whatever the module put next to it. */
function event(fields: { readonly type: EventName } & Readonly<Record<string, unknown>>): {
  readonly type: EventName;
} {
  return fields;
}

describe('a module event in the trail', () => {
  it('is placed in its website, names its member and keeps only the describing fields', () => {
    const entry = toAuditEntry(
      event({
        type: 'thing.changed',
        tenantId: 'site-1',
        websiteId: 'site-1',
        actorId: 'actor-1',
        thingId: 'thing-9',
        count: 3,
        fields: ['name', 'slug'],
        nested: { secret: 'never' },
      }),
      SOURCE,
      AT,
    );

    expect(entry).toEqual({
      websiteId: 'site-1',
      source: 'booking',
      type: 'thing.changed',
      severity: 'info',
      actor: { kind: 'member', id: 'actor-1' },
      details: { thingId: 'thing-9', count: 3, fields: ['name', 'slug'] },
      occurredAt: AT,
    });
  });

  it('is a visitor’s when the event names nobody and the policy says so', () => {
    const entry = toAuditEntry(event({ type: 'thing.booked', tenantId: 'site-1' }), SOURCE, AT);

    expect(entry?.actor).toEqual({ kind: 'visitor' });
    expect(entry?.websiteId).toBe('site-1');
  });

  it('carries the module’s warning level', () => {
    const entry = toAuditEntry(
      event({ type: 'thing.refused', tenantId: 'site-1', actorId: 'actor-1' }),
      SOURCE,
      AT,
    );

    expect(entry?.severity).toBe('warn');
  });

  it('is a warning when the event names an error, whatever the level of its type', () => {
    const failed = toAuditEntry(
      event({ type: 'thing.changed', tenantId: 'site-1', actorId: 'actor-1', errorCode: 'x.down' }),
      SOURCE,
      AT,
    );
    const passed = toAuditEntry(
      event({ type: 'thing.changed', tenantId: 'site-1', actorId: 'actor-1', errorCode: null }),
      SOURCE,
      AT,
    );

    expect(failed?.severity).toBe('warn');
    expect(passed?.severity).toBe('info');
  });

  it('is not kept when the policy leaves it in the logs', () => {
    expect(toAuditEntry(event({ type: 'thing.swept', tenantId: 'site-1' }), SOURCE, AT)).toBeNull();
  });

  it('is not kept when it belongs to no website', () => {
    expect(
      toAuditEntry(event({ type: 'thing.changed', actorId: 'actor-1' }), SOURCE, AT),
    ).toBeNull();
    expect(
      toAuditEntry(
        event({ type: 'thing.refused', tenantId: 'platform', actorId: 'actor-1' }),
        SOURCE,
        AT,
      ),
    ).toBeNull();
  });
});
