import { db } from '@lib/db';
import { PLATFORM_EMAIL_BRAND, createEmailBrand } from '@lib/mail';
import type { EmailBrand } from '@lib/mail';

import type { WebsiteId } from '../../domain/models/ids';

/** What a booking message takes from its website: where the website lives, and its look. */
export interface WebsiteMailIdentity {
  /** `null`: the website is gone, so the message has no link to it. */
  readonly slug: string | null;
  readonly brand: EmailBrand;
}

/**
 * The website's slug and stored theme. A website without a theme gets the platform's look; a value
 * the theme stores is looked up in a closed list by `createEmailBrand`, never written into a style.
 * Throws on a database failure: the notifier catches it and still sends.
 */
export async function readWebsiteMailIdentity(websiteId: WebsiteId): Promise<WebsiteMailIdentity> {
  const [website, theme] = await Promise.all([
    db.orm.public.Website.where({ id: websiteId }).select('slug').first(),
    db.orm.public.WebsiteTheme.where({ websiteId })
      .select('primaryColor', 'radius', 'headingFont', 'bodyFont', 'spacingScale')
      .first(),
  ]);
  return {
    slug: website?.slug ?? null,
    brand:
      theme === null
        ? PLATFORM_EMAIL_BRAND
        : createEmailBrand({
            primary: theme.primaryColor,
            radius: theme.radius,
            headingFont: theme.headingFont,
            bodyFont: theme.bodyFont,
            spacingScale: theme.spacingScale,
          }),
  };
}
