import { Badge } from '@components/ui/badge';
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
}

type AriaSort = 'ascending' | 'descending' | undefined;

function ariaSortOf(sort: SortSpec<UserSortField>, field: UserSortField): AriaSort {
  if (sort.field !== field) {
    return undefined;
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/** The member rows. Management controls are drawn only for people who may use them. */
export async function UsersTable({ users, selfId, canManage, sort, sortHref }: UsersTableProps) {
  const [t, formats] = await Promise.all([getTranslations('auth'), getAppFormatters()]);

  if (users.length === 0) {
    return <p className="text-sm text-copy-muted">{t('users.table.empty')}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead aria-sort={ariaSortOf(sort, 'name')}>
            <Link href={sortHref('name')}>{t('users.table.name')}</Link>
          </TableHead>
          <TableHead aria-sort={ariaSortOf(sort, 'email')}>
            <Link href={sortHref('email')}>{t('users.table.email')}</Link>
          </TableHead>
          <TableHead>{t('users.table.roles')}</TableHead>
          <TableHead aria-sort={ariaSortOf(sort, 'createdAt')}>
            <Link href={sortHref('createdAt')}>{t('users.table.since')}</Link>
          </TableHead>
          {canManage && <TableHead>{t('users.table.actions')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const row = toUserRowDto(user, selfId);
          return (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>
                {row.email}
                {!row.isVerified && (
                  <Badge variant="warning" className="ml-2">
                    {t('users.table.unverified')}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="space-x-1">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {t(ROLE_MESSAGE_KEYS[role])}
                  </Badge>
                ))}
              </TableCell>
              <TableCell>{formats.date(row.createdAt)}</TableCell>
              {canManage && (
                <TableCell>
                  <UserRowActions user={row} />
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
