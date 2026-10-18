import type { ReactNode } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Badge } from '@components/ui/badge';
import { ChevronDown, ChevronUp, Search } from '@components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { Link } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { SortSpec } from '@lib/pagination';

import { toUserRowDto } from '../dto/user-dto';
import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import { UserRowActions } from './user-row-actions.client';

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

type AriaSort = 'ascending' | 'descending' | undefined;

function ariaSortOf(sort: SortSpec<UserSortField>, field: UserSortField): AriaSort {
  if (sort.field !== field) {
    return undefined;
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/** Up to two letters of a name, for the avatar circle. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]?.slice(0, 2)];
  return letters
    .map((word) => word?.[0] ?? '')
    .join('')
    .toUpperCase();
}

/** A column heading that sorts by its field; the arrow shows the current direction. */
function SortLink({
  href,
  label,
  direction,
}: {
  readonly href: string;
  readonly label: string;
  readonly direction: AriaSort;
}) {
  const Arrow = direction === 'descending' ? ChevronDown : ChevronUp;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-sm hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {label}
      <Arrow
        className={direction === undefined ? 'size-3.5 opacity-0' : 'size-3.5'}
        aria-hidden="true"
      />
    </Link>
  );
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
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-xs font-semibold text-copy-muted"
                      >
                        {initialsOf(row.name)}
                      </span>
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
