import type { MetadataRoute } from 'next';

import { I18N_CONFIG } from '@i18n';

import { publicEnv } from '@lib/config';
import { buildAlternateLanguages, toLocalizedPath } from '@lib/seo';
import { mapValues } from '@lib/utils';

/** Only pages anyone may see: the admin area is private, and published sites are not listed yet. */
const INDEXABLE_PATHNAMES = ['/'] as const;

function toAbsoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_APP_URL).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHNAMES.flatMap((pathname) => {
    const languages = mapValues(buildAlternateLanguages(pathname), toAbsoluteUrl);

    return I18N_CONFIG.locales.map((locale) => ({
      url: toAbsoluteUrl(toLocalizedPath(locale, pathname)),
      alternates: { languages },
    }));
  });
}
