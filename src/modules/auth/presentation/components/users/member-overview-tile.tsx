import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { MemberSummaryView } from '../../../application/contracts/user-views';

export interface MemberOverviewTileProps {
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  readonly summary: MemberSummaryView;
  /** The website's member list; the website module owns that address. */
  readonly usersHref: string;
}

/** The people of a website at a glance for its overview: how many, in which roles, and who is still invited. */
export async function MemberOverviewTile({ locale, summary, usersHref }: MemberOverviewTileProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    getAppFormatters(),
  ]);
  const roles = summary.byRole
    .filter(({ count }) => count > 0)
    .map(({ role, count }) => `${format.number(count)} ${t(ROLE_MESSAGE_KEYS[role])}`)
    .join(' · ');

  return (
    <OverviewTile
      label={t('users.overview.title')}
      value={format.number(summary.members)}
      detail={roles}
      hint={
        summary.openInvitations > 0
          ? `${format.number(summary.openInvitations)} ${t('users.overview.openInvitations')}`
          : undefined
      }
      href={usersHref}
    />
  );
}
