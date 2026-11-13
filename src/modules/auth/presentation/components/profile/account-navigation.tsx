import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import { getAuthQueries } from '../../../composition';

import { AccountMenu } from './account-menu.client';

/** Header reads fail closed without redirecting an anonymous visitor from a parallel layout render. */
export async function AccountNavigation({ locale }: { readonly locale: Locale }) {
  const result = await getAuthQueries().getOwnProfile.execute();
  if (result.isErr()) {
    if (result.error.kind === 'unauthorized') {
      return null;
    }
    throw new Error(result.error.code, { cause: result.error });
  }
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <AccountMenu profile={result.value} />
    </I18nProvider>
  );
}
