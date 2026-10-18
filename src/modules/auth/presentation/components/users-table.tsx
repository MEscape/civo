import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
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

import { toUserRowDto } from '../dto/user-dto';
import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import { UserRowActions } from './user-row-actions.client';
import { SortLink, UserAvatar, ariaSortOf } from './user-table-parts';

import type { UserSortField } from '../../application/contracts/auth-constraints';
import type { UserView } from '../../application/contracts/user-views';

export interface UsersTableProps {
  readonly users: readonly UserView[];
  readonly selfId: string;
  readonly canManage: boolean;
  readonly sort: SortSpec<UserSortField>;
  /** The address that sorts by `field` (flipping the direction when it is the current one). */
  readonly sortHref: (field: UserSortField) => string;
  /** Every member that matches, not only this page. */
  readonly total: number;
  /** The filters, drawn as a strip between the panel's header and the rows. */
  readonly toolbar?: ReactNode;
  /** The page links, drawn in the panel's footer. */
  readonly pagination?: ReactNode;
}

/** The member rows. Management controls are drawn only for people who may use them. */
export async function UsersTable({
  users,
  selfId,
  canManage,
  sort,
  sortHref,
  total,
  toolbar,
  pagination,
}: UsersTableProps) {
  const [t, formats] = await Promise.all([getTranslations('auth'), getAppFormatters()]);

  return (
    <DataPanel
      title={t('users.table.title')}
      meta={t('users.table.count', { count: total })}
      footer={pagination}
    >
      {toolbar}
      {users.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<Search className="size-6" aria-hidden="true" />}
          title={t('users.table.empty')}
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
              <TableHead>{t('users.table.roles')}</TableHead>
              <TableHead aria-sort={ariaSortOf(sort, 'createdAt')} className="hidden sm:table-cell">
                <SortLink
                  href={sortHref('createdAt')}
                  label={t('users.table.since')}
                  direction={ariaSortOf(sort, 'createdAt')}
                />
              </TableHead>
              {canManage && (
                <TableHead>
                  <span className="sr-only">{t('users.table.actions')}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const row = toUserRowDto(user, selfId);
              return (
                <TableRow key={row.id} className="align-top">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={row.name} />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 font-medium text-copy">
                          {row.name}
                          {row.isSelf && <Badge variant="muted">{t('users.table.you')}</Badge>}
                        </p>
                        {/* Below md the email column folds into the name cell. */}
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-copy-muted md:hidden">
                          <span className="truncate">{row.email}</span>
                          {!row.isVerified && (
                            <Badge variant="warning">{t('users.table.unverified')}</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-copy-muted md:table-cell">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {row.email}
                      {!row.isVerified && (
                        <Badge variant="warning">{t('users.table.unverified')}</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ul className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <li key={role}>
                          <Badge variant="outline">{t(ROLE_MESSAGE_KEYS[role])}</Badge>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-copy-muted sm:table-cell">
                    {formats.date(row.createdAt)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <UserRowActions user={row} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DataPanel>
  );
}
