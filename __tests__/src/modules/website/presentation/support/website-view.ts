import type { WebsiteView } from '@modules/website/application/contracts/website-views';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';

export const websiteView: WebsiteView = {
  id: 'site-1',
  name: 'Example town',
  slug: 'example-town',
  description: null,
  templateKey: 'municipal',
  theme: DEFAULT_WEBSITE_THEME,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-10-29T12:00:00Z'),
};
