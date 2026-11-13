import type { ReactNode } from 'react';

import { Search, UserPlus } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { SortSpec } from '@lib/pagination';

import { UserAccessDetails } from './user-access-details';
import { hasAccessDetails } from './user-access-summary';
import { usersTableColumns } from './users-table-columns';

import type { UserSortField } from '../../../application/contracts/auth-constraints';
import type { PlatformUserView } from '../../../application/contracts/user-views';
import type { UsersScope } from '../../loaders/load-users-administration';
import type { AuthTranslator } from '../../translation/translator';

export interface UsersTableProps {
  readonly users: readonly PlatformUserView[];
  readonly selfId: string;
  /** Where the table is shown: inside one website the access column names no website. */
  readonly scope: UsersScope['kind'];
  /** Whether any access control is drawn at all. */
  readonly canManage: boolean;
  readonly canManagePlatform: boolean;
  /** Every website the controls may offer, named. */
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** The websites the viewer may change access in; `null` is every website. */
  readonly manageableTenantIds: readonly string[] | null;
  /** The page that manages one website's people, for the controls to link to; absent inside a website. */
  readonly websiteHrefs?: Readonly<Record<string, string>> | undefined;
  /** Inside one website: where access to other websites is managed. */
  readonly globalUsersHref?: string | undefined;
  readonly sort: SortSpec<UserSortField>;
  /** The address that sorts by `field` (flipping the direction when it is the current one). */
  readonly sortHref: (field: UserSortField) => string;
  /** Every person that matches, not only this page. */
  readonly total: number;
  /** The filters, drawn as a strip between the panel's header and the rows. */
  readonly toolbar?: ReactNode;
  /** The page links, drawn in the panel's footer. */
  readonly pagination?: ReactNode;
  /** Whether a search or filter narrows the list: an empty list then means "no match", not "nobody". */
  readonly isFiltered: boolean;
  /** The unfiltered list. */
  readonly resetHref: string;
  /** Where to invite someone; absent for a viewer who may not. */
  readonly inviteHref?: string | undefined;
}

interface UsersEmptyStateProps {
  readonly t: AuthTranslator;
  readonly isFiltered: boolean;
  readonly resetHref: string;
  readonly inviteHref?: string | undefined;
}

/** "No match" offers to clear the filters; an empty list offers the invitation that fills it. */
function UsersEmptyState({ t, isFiltered, resetHref, inviteHref }: UsersEmptyStateProps) {
  if (isFiltered) {
    return (
      <EmptyState
        className="py-10"
        icon={<Search className="size-6" aria-hidden="true" />}
        title={t('users.table.noMatch')}
        description={t('users.table.noMatchDescription')}
        action={
          <Link href={resetHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('users.filters.reset')}
          </Link>
        }
      />
    );
  }
  return (
    <EmptyState
      className="py-10"
      icon={<UserPlus className="size-6" aria-hidden="true" />}
      title={t('users.table.empty')}
      description={t('users.table.emptyDescription')}
      action={
        inviteHref === undefined ? undefined : (
          <Link href={inviteHref} className={buttonVariants({ size: 'sm' })}>
            <UserPlus className="size-4" aria-hidden="true" />
            {t('users.invite.action')}
          </Link>
        )
      }
    />
  );
}

/** The people rows. Management controls are drawn only for people who may use them. */
export async function UsersTable({
  users,
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
  total,
  toolbar,
  pagination,
  isFiltered,
  resetHref,
  inviteHref,
}: UsersTableProps) {
  const [t, format] = await Promise.all([getTranslations('auth'), getAppFormatters()]);
  return (
    <DataPanel
      title={t('users.table.title')}
      meta={t('users.table.count', { count: total })}
      footer={pagination}
    >
      {toolbar}
      <ResponsiveTable
        label={t('users.table.title')}
        rows={users}
        rowKey={(user) => user.id}
        rowDetails={(user) =>
          hasAccessDetails(user, scope === 'global') ? (
            <UserAccessDetails user={user} websites={websites} scope={scope} t={t} />
          ) : null
        }
        columns={usersTableColumns({
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
        })}
        state={{
          kind: 'ready',
          empty: (
            <UsersEmptyState
              t={t}
              isFiltered={isFiltered}
              resetHref={resetHref}
              inviteHref={inviteHref}
            />
          ),
        }}
      />
    </DataPanel>
  );
}
