import { useLocale, useTimeZone } from 'next-intl';

import { I18N_CONFIG } from './config';
import { createAppFormatters, type AppFormatters } from './formatters';

/** The current locale's formatters, for Client Components. */
export function useAppFormatters(): AppFormatters {
  const locale = useLocale();
  const timeZone = useTimeZone() ?? I18N_CONFIG.defaultTimeZone;
  return createAppFormatters(locale, timeZone);
}
