import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateWebsiteThemeAction } from '@modules/website/presentation/actions/update-website-theme-action';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { websiteView } from '../support/website-view';

const boundary = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/website/composition', () => ({
  getWebsiteCommands: () => ({ updateWebsiteTheme: { execute: boundary.execute } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  boundary.execute.mockReset();
  boundary.revalidate.mockClear();
});
const input = { websiteId: 'site-1', theme: websiteView.theme };

describe('updateWebsiteThemeAction', () => {
  it('refuses malformed theme tokens before mutation', async () => {
    expect(await updateWebsiteThemeAction({ websiteId: 'site-1', theme: {} })).toMatchObject({
      ok: false,
      error: { code: 'website.validation_failed' },
    });
    expect(boundary.execute).not.toHaveBeenCalled();
  });

  it('invalidates the returned website layout so its editor and preview receive the saved theme', async () => {
    boundary.execute.mockReturnValue(okAsync(websiteView));
    expect(await updateWebsiteThemeAction(input)).toMatchObject({
      ok: true,
      data: { theme: websiteView.theme },
    });
    expect(boundary.revalidate.mock.calls).toEqual([
      ['/[locale]/(protected)/websites/[websiteId]', 'layout'],
    ]);
  });

  it('keeps infrastructure failures observable without serializing private causes', async () => {
    boundary.execute.mockReturnValue(
      errAsync(
        infrastructureError(
          'website.persistence_failed',
          'Unavailable',
          new Error('private driver detail'),
        ),
      ),
    );
    const result = await updateWebsiteThemeAction(input);
    expect(result).toMatchObject({ ok: false, error: { code: 'website.persistence_failed' } });
    expect(JSON.stringify(result)).not.toContain('private driver detail');
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
