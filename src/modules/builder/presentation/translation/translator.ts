import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `builder` translator a Server Component gets from `getTranslations('builder')`. */
export type BuilderTranslator = Awaited<ReturnType<typeof getTranslations<'builder'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
