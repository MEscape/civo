import type { MetadataRoute } from 'next';

import { authRoutes } from '@modules/auth';
import { websiteRoutes } from '@modules/website';

import { I18N_CONFIG } from '@i18n';

import { publicEnv } from '@lib/config';
import { toLocalizedPath } from '@lib/seo';

/**
 * Crawlers may read the public pages and the published sites. The admin
 * area and the pages reached through emailed single-use links are excluded
 * here as well as marked `noindex`, so they are not even fetched. Paths come
 * from the modules' route tables, so a moved route stays excluded.
 */
const PRIVATE_PATHNAMES = [
  websiteRoutes.list(),
  authRoutes.resetPassword(),
  authRoutes.emailVerified(),
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        ...I18N_CONFIG.locales.flatMap((locale) =>
          PRIVATE_PATHNAMES.map((pathname) => toLocalizedPath(locale, pathname)),
        ),
      ],
    },
    sitemap: new URL('/sitemap.xml', publicEnv.NEXT_PUBLIC_APP_URL).toString(),
  };
}
