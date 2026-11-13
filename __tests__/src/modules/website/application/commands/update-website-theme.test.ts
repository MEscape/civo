import { describe, expect, it } from 'vitest';

import { UpdateWebsiteTheme } from '@modules/website/application/commands/update-website-theme';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';

import { SCOPE_IDS } from '../../../auth/application/support/user-management-scope-world';
import { world } from '../support/website-world';

describe('update-website-theme through auth permissions', () => {
  it('updates the theme only in the authorized target', async () => {
    const { deps, writes, events } = world();
    const theme = {
      ...DEFAULT_WEBSITE_THEME,
      colors: { ...DEFAULT_WEBSITE_THEME.colors, primary: '#112233' },
    };
    expect(
      (
        await new UpdateWebsiteTheme(deps).execute({ websiteId: SCOPE_IDS.b, theme })
      )._unsafeUnwrap().theme,
    ).toEqual(theme);
    expect(writes).toEqual([SCOPE_IDS.b]);
    expect(events).toEqual([
      expect.objectContaining({ type: 'website.theme_updated', tenantId: SCOPE_IDS.b }),
    ]);
  });
});
