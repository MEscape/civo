import type { getAppFormatters, getTranslations } from '@i18n/server';

/** The `audit` translator a Server Component gets from `getTranslations('audit')`. */
export type AuditTranslator = Awaited<ReturnType<typeof getTranslations<'audit'>>>;

/** The locale-aware formatters a Server Component gets from `getAppFormatters()`. */
export type AppFormatters = Awaited<ReturnType<typeof getAppFormatters>>;
