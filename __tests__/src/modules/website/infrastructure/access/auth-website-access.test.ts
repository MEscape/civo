import { describe, expect, it } from 'vitest';

import { world } from '../../application/support/website-world';

describe('auth-website-access through auth permissions', () => {
  it('refuses non-string input at the access boundary', async () => {
    const { deps, reads } = world();
    expect((await deps.access.authorizeWebsite('website.read', null))._unsafeUnwrapErr().kind).toBe(
      'validation',
    );
    expect(reads).toEqual([]);
  });
});
