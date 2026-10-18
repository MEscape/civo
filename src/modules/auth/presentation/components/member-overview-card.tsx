import {
  OverviewCard,
  OverviewRow,
  OverviewStat,
  OverviewStats,
} from '@components/shared/overview-card';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import type { MemberSummaryView } from '../../application/contracts/user-views';

export interface MemberOverviewCardProps {
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  readonly summary: MemberSummaryView;
  /** The website's member list; the website module owns that address. */
  readonly usersHref: string;
}

/** The people of a website at a glance for its overview: how many, in which roles, and who is still invited. */
export async function MemberOverviewCard({ locale, summary, usersHref }: MemberOverviewCardProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    getAppFormatters(),
  ]);

  return (
    <OverviewCard
      title={t('users.overview.title')}
      link={{ href: usersHref, label: t('users.overview.link') }}
    >
      <OverviewRow>
        <OverviewStats>
          <OverviewStat
            label={t('users.overview.members')}
            value={format.number(summary.members)}
          />
          <OverviewStat
            label={t('users.overview.openInvitations')}
            value={format.number(summary.openInvitations)}
          />
        </OverviewStats>
      </OverviewRow>
      <OverviewRow>
        <ul aria-label={t('users.overview.byRole')} className="flex flex-wrap gap-1.5">
          {summary.byRole.map(({ role, count }) => (
            <li key={role}>
              <Badge variant={count > 0 ? 'outline' : 'muted'}>
                {t(ROLE_MESSAGE_KEYS[role])}
                <span className="font-semibold">{format.number(count)}</span>
              </Badge>
            </li>
          ))}
        </ul>
      </OverviewRow>
    </OverviewCard>
  );
}
