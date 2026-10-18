import { describe, expect, it } from 'vitest';

import { permissionDenied } from '@modules/auth/domain/errors/auth-errors';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { Role } from '@modules/auth/domain/models/role';
import { ListWebsiteOptions } from '@modules/website/application/queries/list-website-options';
import type { WebsiteDependencies } from '@modules/website/application/website-dependencies';

import { errAsync, okAsync } from '@lib/result';

function query(roles: readonly Role[], options: { readonly isTruncated?: boolean } = {}) {
  const asked: number[] = [];
  const deps = {
    authorization: {
      requireInTenant: (permission: Parameters<typeof decide>[1]) => {
        const actor = { id: toActorId('a'), tenantId: toTenantId('platform'), roles };
        return decide(actor, permission).isAllowed ? okAsync(actor) : errAsync(permissionDenied());
      },
    },
    websites: {
      listOptions: (limit: number) => {
        asked.push(limit);
        return okAsync({
          items: [{ id: 'site-1', name: 'Würzburg' }],
          isTruncated: options.isTruncated ?? false,
        });
      },
    },
  } as unknown as WebsiteDependencies;
  return { run: () => new ListWebsiteOptions(deps).execute(), asked };
}

describe('choosing a website', () => {
  it('offers every website by name, with a bound that says when it cut the list', async () => {
    const complete = await query(['platform_admin']).run();
    const cut = await query(['platform_admin'], { isTruncated: true }).run();

    expect(complete._unsafeUnwrap()).toEqual({
      websites: [{ id: 'site-1', name: 'Würzburg' }],
      isTruncated: false,
    });
    expect(cut._unsafeUnwrap().isTruncated).toBe(true);
  });

  it('reads one bounded list, and only for those who may list every website', async () => {
    const { run, asked } = query(['platform_admin']);
    await run();

    expect(asked).toEqual([1000]);
    expect((await query(['admin']).run()).isErr()).toBe(true);
  });
});
