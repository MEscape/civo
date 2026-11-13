import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { DeleteUnusedMap } from '@modules/release/application/commands/delete-unused-map';
import { toWebsiteId } from '@modules/release/domain/models/ids';
import type { Release } from '@modules/release/domain/models/release';
import type { MapSource } from '@modules/release/domain/ports/map-source.port';
import type { PageSource } from '@modules/release/domain/ports/page-source.port';
import type { ReleaseAccess } from '@modules/release/domain/ports/release-access.port';
import type { ReleaseRepository } from '@modules/release/domain/ports/release.repository';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../../support/rate-limiting';

const WEBSITE = '00000000-0000-4000-8000-000000000001';
const MAP = '00000000-0000-4000-8000-000000000002';
const actor: Actor = { id: toActorId('actor-1'), tenantId: toTenantId('site-1'), roles: ['admin'] };

/** A map module that asks the guard like the real one: after authorizing, right before deleting. */
function run(options: {
  readonly draft?: boolean;
  readonly draftStatus?: 'config_missing' | 'config_invalid';
  readonly live?: boolean;
  readonly denied?: boolean;
}) {
  const deleted: string[] = [];
  const auditEvents: string[] = [];
  const maps: MapSource = {
    listForRelease: () => okAsync([]),
    mapsInStoredPage: (stored) => new Set((stored as { places?: string[] }).places ?? []),
    datasetsOfMap: () => new Set(),
    deleteMap: (websiteId, mapId, guard) =>
      guard({ websiteId, mapId }).map(() => {
        deleted.push(mapId);
        auditEvents.push('map.deleted');
      }),
  };
  const draftPlaces = options.draft === true ? [MAP] : [];
  const draftPage =
    options.draftStatus === undefined
      ? {
          status: 'ready',
          path: '',
          title: 'Home',
          config: { places: draftPlaces },
          componentTypes: [],
        }
      : { status: options.draftStatus, path: '', title: 'Home' };
  const pages = {
    listForRelease: () => okAsync([draftPage]),
  } as unknown as PageSource;
  const live = {
    snapshot: {
      pages: [{ path: '', title: 'Home', config: { places: options.live === true ? [MAP] : [] } }],
    },
  } as unknown as Release;
  const access: ReleaseAccess = {
    authorizeWebsite: () =>
      options.denied === true
        ? errAsync(forbiddenError('auth.permission_denied', 'Not allowed.'))
        : okAsync({ actor, websiteId: toWebsiteId(WEBSITE) }),
  };
  const command = new DeleteUnusedMap({
    access,
    authorization: {} as never,
    rateLimiter: createTestRateLimiter(),
    websites: {} as never,
    releases: { findPublished: () => okAsync(live) } as unknown as ReleaseRepository,
    audit: {
      record: (event) => {
        auditEvents.push(event.type);
      },
    },
    maps,
    pages,
  });
  return { command, deleted, auditEvents };
}

describe('DeleteUnusedMap', () => {
  it('deletes a map no draft page and no live page places', async () => {
    const { command, deleted } = run({});

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result.isOk()).toBe(true);
    expect(deleted).toEqual([MAP]);
  });

  it('keeps a map a draft page places', async () => {
    const { command, deleted } = run({ draft: true });

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result._unsafeUnwrapErr().code).toBe('release.map_in_use');
    expect(deleted).toEqual([]);
  });

  it('keeps a map without recording a deletion when a malformed draft hides its usage', async () => {
    const { command, deleted, auditEvents } = run({ draftStatus: 'config_invalid' });

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('release.map_in_use');
    expect(deleted).toEqual([]);
    expect(auditEvents).toEqual([]);
  });

  it('allows deletion when an unsaved draft has no configuration or references', async () => {
    const { command, deleted } = run({ draftStatus: 'config_missing' });

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result.isOk()).toBe(true);
    expect(deleted).toEqual([MAP]);
  });

  it('keeps a map only the live site still places, until the next publish', async () => {
    const { command, deleted } = run({ live: true });

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result._unsafeUnwrapErr().code).toBe('release.map_in_use');
    expect(deleted).toEqual([]);
  });

  it('asks nothing of someone who may not edit pages', async () => {
    const { command, deleted } = run({ denied: true });

    const result = await command.execute({ websiteId: WEBSITE, id: MAP });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(deleted).toEqual([]);
  });
});
