import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { UserAvatar } from '@components/shared/user-avatar';
import { Badge } from '@components/ui/badge';
import { Search } from '@components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { SortSpec } from '@lib/pagination';

import { UserAccessEditor } from './user-access-editor.client';
import { UserAccessList } from './user-access-list';
import { SortLink, ariaSortOf } from './user-table-parts';

import type { AccessWebsite } from './user-access-editor.client';
import type { UserSortField } from '../../application/contracts/auth-constraints';
import type { PlatformUserView } from '../../application/contracts/user-views';

export interface PlatformUsersTableProps {
  readonly users: readonly PlatformUserView[];
  readonly selfId: string;
  readonly total: number;
  readonly sort: SortSpec<UserSortField>;
  /** The address that sorts by `field` (flipping the direction when it is the current one). */
  readonly sortHref: (field: UserSortField) => string;
  readonly websites: readonly AccessWebsite[];
  /** Where a website's own people are managed; the website module owns that address. */
  readonly websiteUsersHref: (websiteId: string) => string;
  /** The filters, drawn as a strip between the panel's header and the rows. */
  readonly toolbar?: ReactNode;
  readonly pagination?: ReactNode;
}

/** The people of every website: who they are, where they work with which roles, and a way to change that. */
export async function PlatformUsersTable({
  users,
  selfId,
  total,
  sort,
  sortHref,
  websites,
  websiteUsersHref,
  toolbar,
  pagination,
}: PlatformUsersTableProps) {
  const [t, formats] = await Promise.all([getTranslations('auth'), getAppFormatters()]);
  const nameOf = (id: string) => websites.find((website) => website.id === id)?.name ?? id;

  return (
    <DataPanel
      title={t('platformUsers.table.title')}
      meta={t('platformUsers.table.count', { count: total })}
      footer={pagination}
    >
      {toolbar}
      {users.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Search className="size-6" aria-hidden="true" />}
          title={t('platformUsers.table.empty')}
        />
      ) : (
        <Table containerClassName="rounded-none border-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead aria-sort={ariaSortOf(sort, 'name')}>
                <SortLink
                  href={sortHref('name')}
                  label={t('users.table.name')}
                  direction={ariaSortOf(sort, 'name')}
                />
              </TableHead>
              <TableHead aria-sort={ariaSortOf(sort, 'email')} className="hidden md:table-cell">
                <SortLink
                  href={sortHref('email')}
                  label={t('users.table.email')}
                  direction={ariaSortOf(sort, 'email')}
                />
              </TableHead>
              <TableHead>{t('platformUsers.table.access')}</TableHead>
              <TableHead aria-sort={ariaSortOf(sort, 'createdAt')} className="hidden sm:table-cell">
                <SortLink
                  href={sortHref('createdAt')}
                  label={t('users.table.since')}
                  direction={ariaSortOf(sort, 'createdAt')}
                />
              </TableHead>
              <TableHead>
                <span className="sr-only">{t('users.table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              return (
                <TableRow key={user.id} className="align-top">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-copy">
                          {user.name}
                          {user.id === selfId && (
                            <Badge variant="muted">{t('platformUsers.table.you')}</Badge>
                          )}
                        </p>
                        {/* Below md the email column folds into the name cell. */}
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-copy-muted md:hidden">
                          <span className="break-all">{user.email}</span>
                          {!user.emailVerified && (
                            <Badge variant="warning">{t('users.table.unverified')}</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-copy-muted md:table-cell">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {user.email}
                      {!user.emailVerified && (
                        <Badge variant="warning">{t('users.table.unverified')}</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <UserAccessList
                      user={user}
                      nameOf={nameOf}
                      websiteUsersHref={websiteUsersHref}
                    />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-copy-muted sm:table-cell">
                    {formats.date(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserAccessEditor
                      userId={user.id}
                      userName={user.name}
                      userEmail={user.email}
                      isPlatformAdmin={user.isPlatformAdmin}
                      memberships={user.memberships}
                      websites={websites}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DataPanel>
  );
}
