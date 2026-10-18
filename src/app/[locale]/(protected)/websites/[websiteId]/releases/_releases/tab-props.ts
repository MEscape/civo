import type { Locale } from '@i18n';

import type { WebsiteAccess } from '@/app/_lib/website-access';

export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** What each tab of the release screen is given. */
export interface TabProps {
  readonly websiteId: string;
  readonly locale: Locale;
  readonly access: WebsiteAccess;
  readonly searchParams: SearchParams;
}
