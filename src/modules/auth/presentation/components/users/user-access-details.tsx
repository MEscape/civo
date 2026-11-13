import { Badge } from '@components/ui/badge';

import { ROLE_HINT_KEYS, ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { TenantRole } from '../../../application/contracts/auth-constraints';
import type { PlatformUserView } from '../../../application/contracts/user-views';
import type { UsersScope } from '../../loaders/load-users-administration';
import type { AuthTranslator } from '../../translation/translator';

/**
 * Inside one website the person has one set of roles: each with what it allows, as one aligned list. Across
 * websites every membership is a card of its own, grouped by website.
 */
function WebsiteRoles({
  roles,
  t,
}: {
  readonly roles: readonly TenantRole[];
  readonly t: AuthTranslator;
}) {
  return (
    <ul className="grid grid-cols-[max-content_1fr] items-baseline gap-x-4 gap-y-2">
      {roles.map((role) => (
        // One row per role, the same two columns in every row: the names line up, and so do the explanations.
        <li key={role} className="col-span-2 grid grid-cols-subgrid items-baseline">
          <Badge variant="outline" className="justify-self-start">
            {t(ROLE_MESSAGE_KEYS[role])}
          </Badge>
          <span className="text-sm text-copy-muted">{t(ROLE_HINT_KEYS[role])}</span>
        </li>
      ))}
    </ul>
  );
}

/** Every readable membership, grouped by website, without increasing the collapsed row's height. */
export function UserAccessDetails({
  user,
  websites,
  scope,
  t,
}: {
  readonly user: PlatformUserView;
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly scope: UsersScope['kind'];
  readonly t: AuthTranslator;
}) {
  if (scope === 'website') {
    return (
      <div className="space-y-3 bg-canvas p-4">
        <h3 className="text-sm font-medium">{t('users.access.rolesTitle', { name: user.name })}</h3>
        <WebsiteRoles roles={user.memberships[0]?.roles ?? []} t={t} />
      </div>
    );
  }
  return (
    <div className="space-y-3 bg-canvas p-4">
      <h3 className="text-sm font-medium">{t('users.access.title', { name: user.name })}</h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {user.memberships.map(({ tenantId, roles }) => (
          <li
            key={tenantId}
            className="space-y-2 rounded-token border border-border bg-surface p-3"
          >
            <p className="text-sm font-medium">
              {websites.find(({ id }) => id === tenantId)?.name ?? tenantId}
            </p>
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role} variant="outline">
                  {t(ROLE_MESSAGE_KEYS[role])}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
