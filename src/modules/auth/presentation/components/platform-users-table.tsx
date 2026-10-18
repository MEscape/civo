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

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import { UserAccessEditor } from './user-access-editor.client';

import type { AccessWebsite } from './user-access-editor.client';
import type { PlatformUserView } from '../../application/contracts/user-views';

/** How many websites a row names before it says "+3 more". */
const SHOWN_MEMBERSHIPS = 3;

export interface PlatformUsersTableProps {
  readonly users: readonly PlatformUserView[];
  readonly selfId: string;
  readonly total: number;
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
  websites,
  websiteUsersHref,
  toolbar,
  pagination,
}: PlatformUsersTableProps) {
  const t = await getTranslations('auth');
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
              <TableHead>{t('platformUsers.table.person')}</TableHead>
              <TableHead>{t('platformUsers.table.access')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('users.table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const shown = user.memberships.slice(0, SHOWN_MEMBERSHIPS);
              const hidden = user.memberships.length - shown.length;
              return (
                <TableRow key={user.id} className="align-top">
                  <TableCell>
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-copy">
                      {user.name}
                      {user.id === selfId && (
                        <Badge variant="muted">{t('platformUsers.table.you')}</Badge>
                      )}
                      {user.isPlatformAdmin && (
                        <Badge variant="default">{t('platformUsers.table.platformAdmin')}</Badge>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-copy-muted">
                      <span className="break-all">{user.email}</span>
                      {!user.emailVerified && (
                        <Badge variant="warning">{t('users.table.unverified')}</Badge>
                      )}
                    </p>
                  </TableCell>
                  <TableCell>
                    {shown.length === 0 ? (
                      <span className="text-xs text-copy-muted">
                        {t('platformUsers.table.noAccess')}
                      </span>
                    ) : (
                      <ul className="space-y-1">
                        {shown.map(({ tenantId, roles }) => (
                          <li
                            key={tenantId}
                            className="flex flex-wrap items-center gap-1.5 text-sm"
                          >
                            <Link
                              href={websiteUsersHref(tenantId)}
                              className="font-medium text-copy underline-offset-4 hover:underline"
                            >
                              {nameOf(tenantId)}
                            </Link>
                            {roles.map((role) => (
                              <Badge key={role} variant="outline">
                                {t(ROLE_MESSAGE_KEYS[role])}
                              </Badge>
                            ))}
                          </li>
                        ))}
                        {hidden > 0 && (
                          <li className="text-xs text-copy-muted">
                            {t('platformUsers.table.more', { count: hidden })}
                          </li>
                        )}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.id !== selfId && (
                      <UserAccessEditor
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                        isPlatformAdmin={user.isPlatformAdmin}
                        memberships={user.memberships}
                        websites={websites}
                      />
                    )}
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
