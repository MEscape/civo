import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNotFound } from '@lib/errors/or-not-found';
import { pageHrefOf, pageParamsSchema } from '@lib/pagination';

import type { WebsiteListReaders } from '../../application/contracts/website-views';

interface LoadWebsitesAdministrationInput {
  readonly locale: Locale;
  readonly pathname: string;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: WebsiteListReaders;
}

/** The page and navigation share the query's resolved pagination, including clamped out-of-range requests. */
export async function loadWebsitesAdministration({
  locale,
  pathname,
  searchParams,
  queries,
}: LoadWebsitesAdministrationInput) {
  const options = pageParamsSchema.parse(searchParams);
  const [websites, t] = await Promise.all([
    orNotFound(queries.listWebsites.execute(options)),
    getTranslations({ locale, namespace: 'website' }),
  ]);
  return {
    websites,
    t,
    hrefFor: (page: number) => pageHrefOf(pathname, page, { pageSize: websites.pageSize }),
  };
}
