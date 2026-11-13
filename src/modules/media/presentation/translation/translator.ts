import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `media` translator a Server Component gets from `getTranslations('media')`. */
export type MediaTranslator = Awaited<ReturnType<typeof getTranslations<'media'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
