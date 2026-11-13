import { TableRowDetailsTrigger } from '@components/shared/table-row-details';
import { Badge } from '@components/ui/badge';

import { ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { PlatformUserView } from '../../../application/contracts/user-views';
import type { AuthTranslator } from '../../translation/translator';

/** Roles named on the line: across websites the website's name takes room there, so only one. */
const summaryLimitOf = (isGlobal: boolean) => (isGlobal ? 1 : 2);

export function hasAccessDetails(user: PlatformUserView, isGlobal: boolean): boolean {
  return (
    user.memberships.length > 1 ||
    user.memberships.some(({ roles }) => roles.length > summaryLimitOf(isGlobal))
  );
}

/**
 * One line, so a row stays as tall as its neighbours: the website (across websites only), the first
 * roles and how many more there are, counting the other websites. Everything else is behind the
 * row's details, which open across the whole table.
 */
export function UserAccessSummary({
  user,
  websites,
  isGlobal,
  t,
}: {
  readonly user: PlatformUserView;
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly isGlobal: boolean;
  readonly t: AuthTranslator;
}) {
  const first = user.memberships[0];
  if (first === undefined) {
    return <span className="text-sm text-copy-muted">{t('users.table.noWebsiteAccess')}</span>;
  }
  const shown = first.roles.slice(0, summaryLimitOf(isGlobal));
  // What the line leaves out: roles beyond the first two, and every other website. One count, one
  // button; the row's details name them all.
  const more = first.roles.length - shown.length + (isGlobal ? user.memberships.length - 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {isGlobal && (
        <span className="mr-1 max-w-full truncate text-sm font-medium">
          {websites.find(({ id }) => id === first.tenantId)?.name ?? first.tenantId}
        </span>
      )}
      {shown.map((role) => (
        <Badge key={role} variant="outline">
          {t(ROLE_MESSAGE_KEYS[role])}
        </Badge>
      ))}
      {more > 0 && <TableRowDetailsTrigger label={t('users.table.moreRoles', { count: more })} />}
    </div>
  );
}
