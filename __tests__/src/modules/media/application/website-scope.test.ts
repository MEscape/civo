import { describe, expect, it } from 'vitest';

import type { Result } from '@lib/result';

import {
  OTHER_TENANT,
  TENANT,
  actorWithRole,
  mediaWorld,
  photo,
  uploadedAsset,
} from '../support/fakes';

const codeOf = async <T, E extends { code: string }>(result: PromiseLike<Result<T, E>>) =>
  (await result)._unsafeUnwrapErr().code;

/**
 * Media belongs to the website the request names, not to whichever website the session has open.
 * A member of one website who names another gets nothing, whatever the id.
 */
describe('website scope', () => {
  const member = () => mediaWorld(actorWithRole(TENANT, 'admin'));

  it('refuses every operation that names a website the person is not a member of', async () => {
    const world = member();
    const { asset } = await uploadedAsset(world);
    await world.completeUpload.execute({ websiteId: TENANT, id: asset.id });

    const denied = 'auth.permission_denied';
    expect(await codeOf(world.listAssets.execute(OTHER_TENANT))).toBe(denied);
    expect(await codeOf(world.requestUpload.execute(photo({ websiteId: OTHER_TENANT })))).toBe(
      denied,
    );
    expect(
      await codeOf(world.completeUpload.execute({ websiteId: OTHER_TENANT, id: asset.id })),
    ).toBe(denied);
    expect(await codeOf(world.getReadUrl.execute({ websiteId: OTHER_TENANT, id: asset.id }))).toBe(
      denied,
    );
    expect(await codeOf(world.deleteAsset.execute({ websiteId: OTHER_TENANT, id: asset.id }))).toBe(
      denied,
    );
    expect(world.assets.rows.size).toBe(1);
  });

  it('writes nothing for a refused upload request', async () => {
    const world = member();
    await world.requestUpload.execute(photo({ websiteId: OTHER_TENANT }));
    expect(world.assets.rows.size).toBe(0);
    expect(world.audit.events).toEqual([]);
  });

  it('can list only public files, so a picker never pages through private ones', async () => {
    const world = member();
    for (const visibility of ['public', 'private', 'public'] as const) {
      const { asset } = await uploadedAsset(world, { visibility });
      await world.completeUpload.execute({ websiteId: TENANT, id: asset.id });
    }

    const publicOnly = (
      await world.listAssets.execute(TENANT, { visibility: 'public' })
    )._unsafeUnwrap();
    expect(publicOnly.total).toBe(2);
    expect(publicOnly.items.every((item) => item.visibility === 'public')).toBe(true);
    expect((await world.listAssets.execute(TENANT))._unsafeUnwrap().total).toBe(3);
  });
});
