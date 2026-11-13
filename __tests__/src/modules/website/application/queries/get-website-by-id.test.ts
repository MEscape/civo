import { describe, expect, it } from 'vitest';

import { GetWebsiteById } from '@modules/website/application/queries/get-website-by-id';

import { unauthorizedError } from '@lib/errors';
import { errAsync } from '@lib/result';

import { SCOPE_IDS } from '../../../auth/application/support/user-management-scope-world';
import { world } from '../support/website-world';

describe('get-website-by-id through auth permissions', () => {
  it('reads an authorized website independently of the currently selected website', async () => {
    const { deps, reads } = world();
    expect((await new GetWebsiteById(deps).execute(SCOPE_IDS.b))._unsafeUnwrap().id).toBe(
      SCOPE_IDS.b,
    );
    expect(reads).toEqual([SCOPE_IDS.b]);
  });

  it('rechecks revoked memberships through already constructed use cases', async () => {
    const { deps, auth, reads } = world();
    const query = new GetWebsiteById(deps);
    auth.roster.get(SCOPE_IDS.b)?.delete(SCOPE_IDS.manager);
    expect((await query.execute(SCOPE_IDS.b))._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(reads).toEqual([]);
  });

  it('authenticates before parsing an invalid target', async () => {
    const { deps, reads } = world();
    deps.authorization.requireActor = () =>
      errAsync(unauthorizedError('auth.unauthenticated', 'Sign in'));
    expect((await new GetWebsiteById(deps).execute(''))._unsafeUnwrapErr().kind).toBe(
      'unauthorized',
    );
    expect(reads).toEqual([]);
  });

  it.each(['', 'x'.repeat(129)])('refuses malformed target %j before reading', async (id) => {
    const { deps, reads } = world();
    expect((await new GetWebsiteById(deps).execute(id))._unsafeUnwrapErr().kind).toBe('validation');
    expect(reads).toEqual([]);
  });
});
