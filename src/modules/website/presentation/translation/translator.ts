import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `website` translator a Server Component gets from `getTranslations('website')`. */
export type WebsiteTranslator = Awaited<ReturnType<typeof getTranslations<'website'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
