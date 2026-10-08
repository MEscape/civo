import type { MetadataRoute } from 'next';

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
    start_url: toLocalizedPath(I18N_CONFIG.defaultLocale, '/'),
    display: 'browser',
    theme_color: APP_IDENTITY.themeColor,
    background_color: APP_IDENTITY.backgroundColor,
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  };
}
