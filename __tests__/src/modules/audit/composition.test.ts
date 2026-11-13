import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditAccessDenied } from '@modules/audit/domain/errors/audit-errors';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';
import type { AuditAccess } from '@modules/audit/domain/ports/audit-access.port';

import { serverEnv } from '@lib/config/server';
import { errAsync, okAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import type { TrailStore } from './support/trail-store';

const state = vi.hoisted((): { stores: TrailStore[] } => ({ stores: [] }));
vi.mock('@modules/audit/infrastructure/prisma/prisma-audit-trail.repository', async () => {
  const { TrailStore } = await import('./support/trail-store');
  return {
    PrismaAuditTrailRepository: class extends TrailStore {
      constructor() {
        super();
        state.stores.push(this);
      }
    },
  };
});

const allowed: AuditAccess = {
  authorizeWebsite: () => okAsync(undefined),
  listReadableWebsites: () => okAsync({ isPlatform: true, websites: [], isTruncated: false }),
};
const denied: AuditAccess = {
  authorizeWebsite: () => errAsync(auditAccessDenied()),
  listReadableWebsites: () => errAsync(auditAccessDenied()),
};

beforeEach(() => {
  vi.resetModules();
  state.stores.length = 0;
});

describe('audit composition', () => {
  it('constructs no persistence adapter just to import or wrap an event log', async () => {
    const { withAuditTrail } = await import('@modules/audit/composition');
    withAuditTrail(
      { record: () => undefined },
      {
        source: 'auth',
        levels: { changed: 'info' },
        policy: { changed: 'member' },
      },
    );
    expect(state.stores).toEqual([]);
  });

  it('refuses every read before auth registration without accessing the store', async () => {
    const { getAuditQueries } = await import('@modules/audit/composition');
    const queries = getAuditQueries();
    const results = await Promise.all([
      queries.getAuditTrail.execute('site-a', EMPTY_AUDIT_FILTER),
      queries.getAuditTrailAcrossWebsites.execute(EMPTY_AUDIT_FILTER),
      queries.getAuditDigest.execute('site-a'),
    ]);
    expect(results.map((result) => result._unsafeUnwrapErr().kind)).toEqual([
      'forbidden',
      'forbidden',
      'forbidden',
    ]);
    expect(state.stores[0]?.reads).toEqual([]);
    expect((await queries.resolveMemberNames(['member-a']))._unsafeUnwrap()).toEqual({ names: [] });
  });

  it('uses current access registration even when readers already exist', async () => {
    const { getAuditQueries, setAuditAccessAdapter, auditQueries } =
      await import('@modules/audit/composition');
    const queries = getAuditQueries();
    setAuditAccessAdapter(allowed);
    expect((await queries.getAuditTrail.execute('site-a', EMPTY_AUDIT_FILTER)).isOk()).toBe(true);
    const readsBeforeRevocation = state.stores[0]?.reads.length;
    setAuditAccessAdapter(denied);
    expect((await queries.getAuditTrail.execute('site-a', EMPTY_AUDIT_FILTER)).isErr()).toBe(true);
    expect(state.stores[0]?.reads).toHaveLength(readsBeforeRevocation ?? 0);
    expect(auditQueries.getAllWebsitesAuditTrail).toBe(queries.getAuditTrailAcrossWebsites);
    expect(auditQueries.getAuditTrail).toBe(queries.getAuditTrail);
    expect(auditQueries.getAuditTrailAcrossWebsites).toBe(queries.getAuditTrailAcrossWebsites);
    expect(auditQueries.getAuditDigest).toBe(queries.getAuditDigest);
  });

  it('preserves registered names when access is replaced without a new resolver', async () => {
    const { getAuditQueries, setAuditAccessAdapter } = await import('@modules/audit/composition');
    const queries = getAuditQueries();
    setAuditAccessAdapter(allowed, () => okAsync({ names: [{ id: 'a', name: 'Anna' }] }));
    setAuditAccessAdapter(denied);
    expect((await queries.resolveMemberNames(['a']))._unsafeUnwrap()).toEqual({
      names: [{ id: 'a', name: 'Anna' }],
    });
  });

  it('keeps explicit access and name resolution independent of later registration', async () => {
    const { createAuditQueries, setAuditAccessAdapter } =
      await import('@modules/audit/composition');
    const queries = createAuditQueries(allowed, () =>
      okAsync({ names: [{ id: 'a', name: 'Anna' }] }),
    );
    setAuditAccessAdapter(denied, () => okAsync({ names: [] }));
    expect((await queries.getAuditTrail.execute('site-a', EMPTY_AUDIT_FILTER)).isOk()).toBe(true);
    expect((await queries.resolveMemberNames(['a']))._unsafeUnwrap().names).toEqual([
      { id: 'a', name: 'Anna' },
    ]);
  });

  it('logs first and appends only events retained by the source policy', async () => {
    const { withAuditTrail } = await import('@modules/audit/composition');
    const recorded: string[] = [];
    const log = withAuditTrail(
      {
        record: (event: { type: 'changed' | 'noise'; tenantId: string }) => {
          expect(state.stores[0]?.appended ?? []).toEqual([]);
          recorded.push(event.type);
        },
      },
      {
        source: 'auth',
        levels: { changed: 'info', noise: 'info' },
        policy: { changed: 'member', noise: false },
      },
    );
    log.record({ type: 'noise', tenantId: 'site-a' });
    log.record({ type: 'changed', tenantId: 'site-a' });
    expect(recorded).toEqual(['noise', 'changed']);
    expect(state.stores[0]?.appended).toEqual([
      expect.objectContaining({ type: 'changed', websiteId: 'site-a' }),
    ]);
  });

  it('starts retention once, prunes immediately and leaves an unreferenced daily schedule', async () => {
    const now = new Date('2026-10-29T12:00:00Z');
    const schedule: { run?: () => void; interval?: number; isReferenced: boolean } = {
      isReferenced: true,
    };
    // Keep scheduling observable without starting a real timer in the test process.
    vi.stubGlobal('setInterval', (run: () => void, interval: number) => {
      schedule.run = run;
      schedule.interval = interval;
      return {
        unref: () => {
          schedule.isReferenced = false;
        },
      };
    });
    try {
      const { systemClock: clock } = await import('@lib/clock');
      vi.spyOn(clock, 'now').mockReturnValue(now);
      const { startAuditRetention } = await import('@modules/audit/composition');
      startAuditRetention();
      startAuditRetention();
      const cutoff = new Date(now.getTime() - serverEnv.AUDIT_RETENTION_DAYS * MS_PER_DAY);
      expect(state.stores[0]?.cutoffs).toEqual([cutoff]);
      expect(schedule.interval).toBe(MS_PER_DAY);
      expect(schedule.isReferenced).toBe(false);
      schedule.run?.();
      expect(state.stores[0]?.cutoffs).toEqual([cutoff, cutoff]);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
