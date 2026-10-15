import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import { getAuthQueries } from '../../composition';

import { PlatformAdminsPanel } from './platform-admins.client';

export interface PlatformAdminsProps {
  readonly locale: Locale;
}

/**
 * Who administers the platform. Shown on the platform's own screen; the use
 * cases behind it authorize `platform.admin.manage` themselves, so for anyone
 * else it simply renders nothing.
 */
export async function PlatformAdmins({ locale }: PlatformAdminsProps) {
  const queries = getAuthQueries();
  const [admins, actor] = await Promise.all([
    queries.listPlatformAdmins.execute(),
    queries.getCurrentActor.execute(),
  ]);
  if (admins.isErr() || actor.isErr()) {
    return null;
  }
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <PlatformAdminsPanel admins={admins.value} selfId={actor.value.id} />
    </I18nProvider>
  );
}
