import type { ResponsiveColumn } from '@components/shared/responsive-table';

import type { SortSpec } from '@lib/pagination';

import { sortableColumn } from './sortable-column';
import { UserAccessEditor } from './user-access-editor.client';
import { UserAccessSummary } from './user-access-summary';
import { userIdentityColumns } from './user-identity-columns';

import type { UserSortField } from '../../../application/contracts/auth-constraints';
import type { PlatformUserView } from '../../../application/contracts/user-views';
import type { UsersScope } from '../../loaders/load-users-administration';
import type { AppFormatters, AuthTranslator } from '../../translation/translator';

interface UsersTableColumnsInput {
  readonly t: AuthTranslator;
  readonly format: AppFormatters;
  readonly selfId: string;
  readonly scope: UsersScope['kind'];
  readonly canManage: boolean;
  readonly canManagePlatform: boolean;
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly manageableTenantIds: readonly string[] | null;
  readonly websiteHrefs?: Readonly<Record<string, string>> | undefined;
  /** Inside one website: where access to other websites is managed. */
  readonly globalUsersHref?: string | undefined;
  readonly sort: SortSpec<UserSortField>;
  readonly sortHref: (field: UserSortField) => string;
}

/**
 * The columns of the people list: identity, the access each person has, since when, and, only for
 * those who may manage access, the controls. Whether a control is drawn follows the viewer's
 * rights; the server still authorizes every change.
 */
export function usersTableColumns({
  t,
  format,
  selfId,
  scope,
  canManage,
  canManagePlatform,
  websites,
  manageableTenantIds,
  websiteHrefs,
  globalUsersHref,
  sort,
  sortHref,
}: UsersTableColumnsInput): ReadonlyArray<ResponsiveColumn<PlatformUserView>> {
  const isManageable = (tenantId: string) =>
    manageableTenantIds === null || manageableTenantIds.includes(tenantId);

  return [
    ...userIdentityColumns<PlatformUserView>({
      selfId,
      sort,
      sortHref,
      labels: {
        name: t('users.table.name'),
        email: t('users.table.email'),
        you: t('users.table.you'),
        unverified: t('users.table.unverified'),
        platformAdmin: t('users.roles.platformAdmin'),
      },
    }),
    {
      id: 'access',
      label: t('users.table.access'),
      width: '@3xl:w-1/4',
      cell: (user) => (
        <UserAccessSummary user={user} websites={websites} isGlobal={scope === 'global'} t={t} />
      ),
    },
    {
      id: 'createdAt',
      label: t('users.table.since'),
      width: '@3xl:w-1/8',
      ...sortableColumn({ sort, sortHref }, 'createdAt', t('users.table.since')),
      cell: (user) => (
        <time dateTime={user.createdAt.toISOString()}>{format.date(user.createdAt)}</time>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            label: t('users.table.actions'),
            isAction: true,
            cell: (user: PlatformUserView) =>
              user.id === selfId ? null : (
                <div className="flex justify-end gap-1">
                  <UserAccessEditor
                    userId={user.id}
                    userName={user.name}
                    userEmail={user.email}
                    isPlatformAdmin={user.isPlatformAdmin}
                    canManagePlatform={scope === 'global' && canManagePlatform}
                    memberships={user.memberships.filter(({ tenantId }) => isManageable(tenantId))}
                    websites={websites.filter(({ id }) => isManageable(id))}
                    websiteHrefs={websiteHrefs}
                    globalUsersHref={globalUsersHref}
                  />
                </div>
              ),
          },
        ]
      : []),
  ];
}
