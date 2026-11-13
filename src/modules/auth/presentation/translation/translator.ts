import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `auth` translator a Server Component gets from `getTranslations('auth')`. */
export type AuthTranslator = Awaited<ReturnType<typeof getTranslations<'auth'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
