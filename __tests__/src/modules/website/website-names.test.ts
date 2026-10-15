import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth';
import { MAX_NAMED_WEBSITES } from '@modules/website/application/list-limits';
import { ListWebsiteNames } from '@modules/website/application/queries/list-website-names';
import type { WebsiteRepository } from '@modules/website/domain/ports/website.repository';

import { okAsync } from '@lib/result';

describe('the names of the websites someone belongs to', () => {
  it('asks the store for exactly their tenants, bounded, and returns only names', async () => {
    const asked: unknown[] = [];
    const websites = {
      findNames: (ids: unknown, limit: number) => {
        asked.push([ids, limit]);
        return okAsync([{ id: 'site-1', name: 'Town one' }]);
      },
    } as unknown as WebsiteRepository;

    const names = (
      await new ListWebsiteNames({ websites }).execute([toTenantId('site-1'), toTenantId('site-2')])
    )._unsafeUnwrap();

    expect(names).toEqual([{ id: 'site-1', name: 'Town one' }]);
    expect(asked).toEqual([[['site-1', 'site-2'], MAX_NAMED_WEBSITES]]);
  });
});
