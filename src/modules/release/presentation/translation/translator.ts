import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `release` translator a Server Component gets from `getTranslations('release')`. */
export type ReleaseTranslator = Awaited<ReturnType<typeof getTranslations<'release'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
