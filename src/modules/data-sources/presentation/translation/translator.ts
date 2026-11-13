import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `dataSources` translator a Server Component gets from `getTranslations('dataSources')`. */
export type DataSourcesTranslator = Awaited<ReturnType<typeof getTranslations<'dataSources'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
