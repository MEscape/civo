import type { Locale } from '@i18n';

/** What every block of the overview is given: the website, and the language of the page. */
export interface BlockProps {
  readonly websiteId: string;
  readonly locale: Locale;
}
