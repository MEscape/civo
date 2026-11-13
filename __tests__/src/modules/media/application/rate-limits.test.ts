import { describe, expect, it } from 'vitest';

import { MEDIA_RATE_LIMITS } from '@modules/media/application/rate-limits';
import { MEDIA_ERROR_CODES } from '@modules/media/domain/errors/media-errors';

import { infrastructureError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import {
  OTHER_TENANT,
  TENANT,
  actorWithRole,
  mediaWorld,
  photo,
  uploadedAsset,
} from '../support/fakes';

const admin = () => mediaWorld(actorWithRole(TENANT, 'admin'));

describe('media rate limits', () => {
  it('refuses an upload request once the person has used the minute, and writes nothing more', async () => {
    const world = admin();
    const { limit } = MEDIA_RATE_LIMITS.requestUpload;
    // The pending quota (20) is lower than the budget, so clear it as we go.
    for (let attempt = 0; attempt < limit; attempt += 1) {
      await world.requestUpload.execute(photo({ websiteId: world.websiteId }));
      world.assets.rows.clear();
    }

    const refused = await world.requestUpload.execute(photo({ websiteId: world.websiteId }));

    expect(refused._unsafeUnwrapErr()).toMatchObject({
      kind: 'rate_limited',
      code: MEDIA_ERROR_CODES.rateLimited,
    });
    expect(world.assets.rows.size).toBe(0);
  });

  it('counts people apart: another member of the website still gets through', async () => {
    const limiter = createTestRateLimiter();
    const flooder = mediaWorld(actorWithRole(TENANT, 'admin'), { rateLimiter: limiter });
    for (let attempt = 0; attempt < MEDIA_RATE_LIMITS.deleteAsset.limit; attempt += 1) {
      await flooder.deleteAsset.execute({ websiteId: TENANT, id: 'x' });
    }
    expect(
      (await flooder.deleteAsset.execute({ websiteId: TENANT, id: 'x' }))._unsafeUnwrapErr().code,
    ).toBe(MEDIA_ERROR_CODES.rateLimited);

    const colleague = mediaWorld(
      { ...actorWithRole(TENANT, 'editor'), id: 'someone-else' as never },
      { rateLimiter: limiter },
    );
    const { asset } = await uploadedAsset(colleague);
    expect(
      (await colleague.completeUpload.execute({ websiteId: TENANT, id: asset.id })).isOk(),
    ).toBe(true);
  });

  it('does not spend a budget for a person who is not allowed in the website', async () => {
    const limiter = createTestRateLimiter();
    const stranger = mediaWorld(actorWithRole(TENANT, 'admin'), { rateLimiter: limiter });
    for (let attempt = 0; attempt < MEDIA_RATE_LIMITS.readUrl.limit + 5; attempt += 1) {
      await stranger.getReadUrl.execute({ websiteId: OTHER_TENANT, id: 'x' });
    }

    const code = await stranger.getReadUrl.execute({ websiteId: TENANT, id: 'x' });
    expect(code._unsafeUnwrapErr().code).not.toBe(MEDIA_ERROR_CODES.rateLimited);
  });

  it('refuses, as its own failure, when the limiter itself cannot answer', async () => {
    const broken: RateLimiter = {
      enforce: () => errAsync(infrastructureError('rate_limit.store_failed', 'down')),
      enforceAll: () => errAsync(infrastructureError('rate_limit.store_failed', 'down')),
    };
    const world = mediaWorld(actorWithRole(TENANT, 'admin'), { rateLimiter: broken });

    const outcome = await world.requestUpload.execute(photo());

    expect(outcome._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: MEDIA_ERROR_CODES.rateLimiterFailed,
    });
    expect(world.assets.rows.size).toBe(0);
  });
});
