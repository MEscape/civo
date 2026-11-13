import { beforeEach, describe, expect, it, vi } from 'vitest';

import { revalidateLocalizedPath } from '@i18n/revalidation';

const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
beforeEach(() => revalidate.mockClear());

describe('localized cache invalidation', () => {
  it('invalidates every locale of a concrete page address', () => {
    revalidateLocalizedPath('/websites/site-1/builder');
    expect(revalidate.mock.calls).toEqual([
      ['/en/websites/site-1/builder'],
      ['/de/websites/site-1/builder'],
    ]);
  });
  it('keeps a platform page separate from website-scoped pages', () => {
    revalidateLocalizedPath('/websites');
    expect(revalidate.mock.calls).toEqual([['/en/websites'], ['/de/websites']]);
  });
});
