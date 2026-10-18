import { Badge } from '@components/ui/badge';
import { ShieldCheck } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import type { PlatformUserView } from '../../application/contracts/user-views';

/** How many websites a row names before it says "+3 more". */
const SHOWN_MEMBERSHIPS = 3;

export interface UserAccessListProps {
  readonly user: PlatformUserView;
  readonly nameOf: (websiteId: string) => string;
  readonly websiteUsersHref: (websiteId: string) => string;
}

/**
 * Where a person works, as one bordered list that wraps instead of
 * overflowing: a platform administrator first (they work everywhere), then the
 * websites they are a member of with their roles.
 */
export async function UserAccessList({ user, nameOf, websiteUsersHref }: UserAccessListProps) {
  const t = await getTranslations('auth');
  const shown = user.memberships.slice(0, SHOWN_MEMBERSHIPS);
  const hidden = user.memberships.length - shown.length;

  if (shown.length === 0 && !user.isPlatformAdmin) {
    return <span className="text-xs text-copy-muted">{t('platformUsers.table.noAccess')}</span>;
  }

  return (
    <ul className="w-full min-w-52 max-w-md divide-y divide-border overflow-hidden rounded-token border border-border">
      {user.isPlatformAdmin && (
        <li className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-canvas px-3 py-1.5 text-sm">
          <ShieldCheck className="size-4 shrink-0 text-primary-copy" aria-hidden="true" />
          <span className="font-medium text-copy">{t('platformUsers.table.allWebsites')}</span>
          <Badge variant="default">{t('platformUsers.table.platformAdmin')}</Badge>
        </li>
      )}
      {shown.map(({ tenantId, roles }) => (
        <li key={tenantId} className="space-y-1 px-3 py-1.5 text-sm">
          <Link
            href={websiteUsersHref(tenantId)}
            className="block truncate font-medium text-copy underline-offset-4 hover:underline"
          >
            {nameOf(tenantId)}
          </Link>
          <span className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge key={role} variant="outline">
                {t(ROLE_MESSAGE_KEYS[role])}
              </Badge>
            ))}
          </span>
        </li>
      ))}
      {hidden > 0 && (
        <li className="bg-canvas px-3 py-1.5 text-xs text-copy-muted">
          {t('platformUsers.table.more', { count: hidden })}
        </li>
      )}
    </ul>
  );
}
