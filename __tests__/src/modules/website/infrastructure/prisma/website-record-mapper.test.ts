import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import {
  toThemeData,
  toWebsite,
  toWebsiteSummary,
} from '@modules/website/infrastructure/prisma/website-record-mapper';

vi.mock('@modules/auth', async () => import('@modules/auth/domain/models/ids'));
vi.mock('@lib/db', async () => import('@lib/db/temporal'));

const row = {
  id: 'site-1',
  tenantId: 'site-1',
  name: 'Town',
  slug: 'town',
  description: null,
  templateKey: 'municipal',
  createdAt: { epochMilliseconds: 1000 },
  updatedAt: { epochMilliseconds: 2000 },
};

describe('website persistence mapping', () => {
  it('converts timestamp columns, preserves ownership, and omits themes from summary views', () => {
    expect(toWebsiteSummary(row)).toEqual({
      ...row,
      createdAt: new Date(1000),
      updatedAt: new Date(2000),
    });
  });

  it('treats removed templates as unavailable without losing website data', () => {
    expect(toWebsiteSummary({ ...row, templateKey: 'removed' })).toMatchObject({
      name: 'Town',
      templateKey: null,
    });
  });

  it('round-trips valid themes and restores defaults for missing or obsolete stored fields', () => {
    const theme = toThemeData(DEFAULT_WEBSITE_THEME);
    expect(toWebsite({ ...row, theme }).theme).toEqual(DEFAULT_WEBSITE_THEME);
    expect(toWebsite({ ...row, theme: null }).theme).toEqual(DEFAULT_WEBSITE_THEME);
    expect(
      toWebsite({ ...row, theme: { ...theme, headingFont: 'Removed', primaryColor: 'red' } }).theme,
    ).toEqual(DEFAULT_WEBSITE_THEME);
  });
});
