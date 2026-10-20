import type { MetadataRoute } from 'next';

import { websiteRoutes } from '@modules/website';

import { I18N_CONFIG } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';
import { toLocalizedPath } from '@lib/seo';

/**
 * The web app manifest. It is one file for every locale, so its description
 * comes from the default locale's catalog.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: I18N_CONFIG.defaultLocale, namespace: 'app.metadata' });
  return {
    name: APP_IDENTITY.name,
    short_name: APP_IDENTITY.name,
    description: t('description'),
    lang: I18N_CONFIG.defaultLocale,
    start_url: toLocalizedPath(I18N_CONFIG.defaultLocale, websiteRoutes.list()),
    display: 'browser',
    theme_color: APP_IDENTITY.colors.primary,
    background_color: APP_IDENTITY.colors.background,
    // The Artemis Connect mark: `app/icon.svg` and `app/apple-icon.png`, served at the root.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
