import { describe, expect, it } from 'vitest';

import { CreateWebsite } from '@modules/website/application/commands/create-website';
import { UpdateWebsite } from '@modules/website/application/commands/update-website';
import { UpdateWebsiteTheme } from '@modules/website/application/commands/update-website-theme';
import { WEBSITE_RATE_LIMITS } from '@modules/website/application/rate-limits';
import { WEBSITE_ERROR_CODES } from '@modules/website/domain/errors/website-errors';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';

import { infrastructureError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';

import { SCOPE_IDS } from '../../../auth/application/support/user-management-scope-world';
import { world } from '../support/website-world';

const rateLimited = { kind: 'rate_limited', code: WEBSITE_ERROR_CODES.rateLimited };

describe('website rate limits', () => {
  it('refuses a details edit once the person has used the minute, and writes nothing more', async () => {
    const { deps, writes } = world();
    const update = new UpdateWebsite(deps);
    for (let attempt = 0; attempt < WEBSITE_RATE_LIMITS.update.limit; attempt += 1) {
      await update.execute({ id: SCOPE_IDS.b, name: `Name ${attempt}` });
    }
    const written = writes.length;

    const refused = await update.execute({ id: SCOPE_IDS.b, name: 'One too many' });

    expect(refused._unsafeUnwrapErr()).toMatchObject(rateLimited);
    expect(writes).toHaveLength(written);
  });

  it('keeps one budget per operation: a spent details budget leaves the theme editable', async () => {
    const { deps } = world();
    const update = new UpdateWebsite(deps);
    for (let attempt = 0; attempt <= WEBSITE_RATE_LIMITS.update.limit; attempt += 1) {
      await update.execute({ id: SCOPE_IDS.b, name: `Name ${attempt}` });
    }

    const theme = await new UpdateWebsiteTheme(deps).execute({
      websiteId: SCOPE_IDS.b,
      theme: DEFAULT_WEBSITE_THEME,
    });
    expect(theme.isOk()).toBe(true);
  });

  it('does not spend a budget for a website the person may not edit', async () => {
    const { deps } = world();
    const update = new UpdateWebsite(deps);
    for (let attempt = 0; attempt <= WEBSITE_RATE_LIMITS.update.limit + 5; attempt += 1) {
      await update.execute({ id: 'not-a-website-i-manage', name: 'x' });
    }

    expect((await update.execute({ id: SCOPE_IDS.b, name: 'Mine' })).isOk()).toBe(true);
  });

  it('refuses, as its own failure, when the limiter cannot answer', async () => {
    const broken: RateLimiter = {
      enforce: () => errAsync(infrastructureError('rate_limit.store_failed', 'down')),
      enforceAll: () => errAsync(infrastructureError('rate_limit.store_failed', 'down')),
    };
    const { deps, writes } = world();

    const outcome = await new UpdateWebsite({ ...deps, rateLimiter: broken }).execute({
      id: SCOPE_IDS.b,
      name: 'Anything',
    });

    expect(outcome._unsafeUnwrapErr()).toMatchObject({
      kind: 'infrastructure',
      code: WEBSITE_ERROR_CODES.rateLimiterFailed,
    });
    expect(writes).toEqual([]);
  });
});

describe('creating websites is limited', () => {
  // The fake store refuses every create, so the first attempts fail on persistence: they still count.
  it('refuses a flood of creations by the same administrator', async () => {
    const { deps } = world({ platform: true });
    const create = new CreateWebsite({
      ...deps,
      homePages: { provision: () => errAsync(infrastructureError('x', 'y')) },
    });
    const outcomes: string[] = [];
    for (let attempt = 0; attempt <= WEBSITE_RATE_LIMITS.create.limit; attempt += 1) {
      const result = await create.execute({
        name: `Town ${attempt}`,
        slug: `town-${attempt}`,
        description: null,
        templateKey: 'municipal',
      });
      outcomes.push(result.isErr() ? result.error.code : 'created');
    }

    expect(outcomes.at(-1)).toBe(WEBSITE_ERROR_CODES.rateLimited);
    expect(outcomes.slice(0, -1)).not.toContain(WEBSITE_ERROR_CODES.rateLimited);
  });
});
