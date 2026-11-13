import { describe, expect, it, vi } from 'vitest';

import type { AuditReaders } from '@modules/audit/application/contracts/audit-views';
import { loadAuditAdministration } from '@modules/audit/presentation/loaders/load-audit-administration';

import { forbiddenError, infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { entryView, trailView } from '../support/trail-view';

vi.mock('@i18n/server', () => ({ getMessages: () => Promise.resolve({}) }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));
const scope = { kind: 'website', websiteId: 'site-1' } as const;

function readers(): AuditReaders {
  return {
    getAuditTrail: { execute: () => okAsync(trailView) },
    getAuditTrailAcrossWebsites: {
      execute: () =>
        okAsync({
          ...trailView,
          reach: 'websites',
          websites: [{ id: 'site-1', name: 'Town' }],
          isWebsitesTruncated: true,
        }),
    },
  };
}
const input = {
  locale: 'en',
  pathname: '/websites/site-1/audit',
  scope,
  searchParams: {},
} as const;

describe('loadAuditAdministration', () => {
  it('loads translated labels for entries and event facets in the selected locale', async () => {
    const queries = readers();
    const view = await loadAuditAdministration({
      ...input,
      queries,
      loadEventLabels: async (locale, entries) => {
        expect(locale).toBe('en');
        expect(entries).toEqual([...trailView.entries.items, ...trailView.types]);
        return { 'website.created': 'Website created' };
      },
    });
    expect(view.eventLabels).toEqual({ 'website.created': 'Website created' });
  });
  it('loads the selected website, parses pagination, and deduplicates permitted actor lookups', async () => {
    const queries: AuditReaders = {
      ...readers(),
      resolveMemberNames: (ids) => {
        expect(ids).toEqual(['actor-1']);
        return okAsync({ names: [{ id: 'actor-1', name: 'Ada' }] });
      },
    };
    let received: unknown;
    queries.getAuditTrail.execute = (websiteId, filter, page) => {
      received = { websiteId, filter, page };
      return okAsync(trailView);
    };
    const view = await loadAuditAdministration({ ...input, searchParams: { page: '2' }, queries });
    expect(received).toMatchObject({ websiteId: 'site-1', page: { page: '2' } });
    expect(view.names).toEqual({ 'actor-1': 'Ada' });
    expect(view.websites).toBeUndefined();
  });

  it('names the members an entry concerns, not only the people who acted', async () => {
    const entry = { ...entryView, details: { subjectId: 'member-9' } };
    let asked: readonly string[] = [];
    const queries: AuditReaders = {
      ...readers(),
      getAuditTrail: {
        execute: () => okAsync({ ...trailView, entries: { ...trailView.entries, items: [entry] } }),
      },
      resolveMemberNames: (ids) => {
        asked = ids;
        return okAsync({ names: [{ id: 'member-9', name: 'Grace' }] });
      },
    };

    const view = await loadAuditAdministration({ ...input, queries });

    expect(asked).toEqual(['actor-1', 'member-9']);
    expect(view.names).toEqual({ 'member-9': 'Grace' });
  });

  it("hands the ids the entries name to the route's resolver and shows what it returns", async () => {
    const entry = { ...entryView, details: { pageId: 'page-1', datasetId: 'set-1' } };
    const subjects = { page: { 'page-1': { state: 'gone' } } } as const;
    let asked: unknown;
    const view = await loadAuditAdministration({
      ...input,
      queries: {
        ...readers(),
        getAuditTrail: {
          execute: () =>
            okAsync({ ...trailView, entries: { ...trailView.entries, items: [entry] } }),
        },
      },
      resolveSubjects: async (ids) => {
        asked = Object.fromEntries(ids);
        return subjects;
      },
    });

    expect(asked).toEqual({ page: ['page-1'], dataset: ['set-1'] });
    expect(view.subjects).toBe(subjects);
  });

  it('preserves global reach and truncation metadata together with the website destination', async () => {
    const href = (id: string) => `/websites/${id}/audit`;
    const view = await loadAuditAdministration({
      ...input,
      scope: { kind: 'global', websiteAuditHref: href },
      queries: readers(),
    });
    expect(view.websites).toEqual([{ id: 'site-1', name: 'Town' }]);
    expect(view.websiteAuditHref?.('site-1')).toBe('/websites/site-1/audit');
    expect(view.trail).toMatchObject({ isWebsitesTruncated: true, reach: 'websites' });
  });

  it('still renders authorized entries when optional name enrichment is unavailable', async () => {
    const queries: AuditReaders = {
      ...readers(),
      resolveMemberNames: () => errAsync(infrastructureError('names.unavailable', 'Unavailable')),
    };
    expect((await loadAuditAdministration({ ...input, queries })).names).toBeNull();
  });

  it('does not look up anonymous entries or call an absent resolver', async () => {
    const queries: AuditReaders = {
      ...readers(),
      resolveMemberNames: () => {
        throw new Error('Unexpected identity lookup');
      },
    };
    queries.getAuditTrail.execute = () =>
      okAsync({
        ...trailView,
        memberIds: [],
        entries: {
          ...trailView.entries,
          items: [{ ...entryView, actorId: null, actorKind: 'visitor' }],
        },
      });
    expect((await loadAuditAdministration({ ...input, queries })).names).toBeNull();
  });

  it('hides denied resources and propagates infrastructure errors rather than returning empty trails', async () => {
    const queries = readers();
    queries.getAuditTrail.execute = () => errAsync(forbiddenError('audit.access_denied', 'Denied'));
    await expect(loadAuditAdministration({ ...input, queries })).rejects.toThrow('not-found');
    const failure = infrastructureError('audit.persistence_failed', 'Unavailable');
    queries.getAuditTrail.execute = () => errAsync(failure);
    await expect(loadAuditAdministration({ ...input, queries })).rejects.toMatchObject({
      cause: failure,
    });
  });
});
