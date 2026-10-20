import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

/** The parts of a website's theme a message is drawn with, as stored. */
export interface WebsiteTheme {
  readonly primaryColor: string;
  readonly radius: string;
  readonly headingFont: string;
  readonly bodyFont: string;
  readonly spacingScale: string;
}

/**
 * Reads how a website looks and where it lives, so the messages sent about its
 * bookings look like it and lead back to it. The theme is handed over as stored; whether a value is
 * a usable colour, radius or font is the mail layout's decision, not the store's.
 */
export interface WebsiteBrandRepository {
  /** The website's stored theme, or `null` when it has none. */
  findThemeOf(websiteId: WebsiteId): AppResultAsync<WebsiteTheme | null, InfrastructureAppError>;

  /** The slug the website's public pages are served under, or `null` when the website is gone. */
  findSlugOf(websiteId: WebsiteId): AppResultAsync<string | null, InfrastructureAppError>;
}
