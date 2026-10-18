'use client';

import { useId, useState, useTransition } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { DataPanel } from '@components/shared/data-panel';
import { FormPanelFooter } from '@components/shared/form-panel';
import { TextField } from '@components/shared/text-field';
import { UserAvatar } from '@components/shared/user-avatar';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { grantPlatformAdminAction } from '../actions/grant-platform-admin-action';
import { revokePlatformAdminAction } from '../actions/revoke-platform-admin-action';

import { AuthFormAlert } from './auth-form-alert';

import type { PlatformAdminView } from '../../application/contracts/platform-admin-views';

export interface PlatformAdminsPanelProps {
  readonly admins: readonly PlatformAdminView[];
  /** The signed-in person: nobody revokes themselves. */
  readonly selfId: string;
}

/**
 * Who administers the platform by membership: one row each with a way to take
 * the role away (after a question), and, in the panel's foot, a field to make
 * another person an administrator by the address of their account.
 */
export function PlatformAdminsPanel({ admins, selfId }: PlatformAdminsPanelProps) {
  const t = useTranslations('auth');
  const id = useId();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<PlatformAdminView | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof grantPlatformAdminAction>, onDone: () => void) {
    setProblem(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone();
      } else {
        setProblem(t('platformAdmins.failed'));
      }
    });
  }

  return (
    <DataPanel
      title={t('platformAdmins.title')}
      description={t('platformAdmins.description')}
      meta={t('platformAdmins.count', { count: admins.length })}
    >
      {admins.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-copy-muted">{t('platformAdmins.none')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {admins.map((admin) => (
            <li key={admin.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={admin.name} />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-copy">
                    {admin.name}
                    {admin.id === selfId && (
                      <Badge variant="muted">{t('platformUsers.table.you')}</Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-copy-muted">{admin.email}</p>
                </div>
              </div>
              {admin.id !== selfId && (
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="sm"
                  disabled={isPending}
                  className="shrink-0"
                  onClick={() => {
                    setLeaving(admin);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  {t('platformAdmins.remove')}
                  <span className="sr-only"> {admin.email}</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        aria-busy={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () => grantPlatformAdminAction({ email }),
            () => {
              setEmail('');
            },
          );
        }}
      >
        <div className="space-y-3 border-t border-border p-4">
          <TextField
            id={`${id}-email`}
            label={t('platformAdmins.email')}
            hint={t('platformAdmins.emailHint')}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <AuthFormAlert id={`${id}-problem`} message={problem} />
        </div>
        <FormPanelFooter>
          <Button type="submit" disabled={isPending || email.trim() === ''}>
            {t('platformAdmins.add')}
          </Button>
        </FormPanelFooter>
      </form>

      <ConfirmDialog
        open={leaving !== null}
        title={t('platformAdmins.confirmTitle', { name: leaving?.name ?? '' })}
        description={t('platformAdmins.confirmDescription')}
        confirmLabel={t('platformAdmins.remove')}
        cancelLabel={t('platformUsers.access.cancel')}
        isPending={isPending}
        onCancel={() => {
          setLeaving(null);
        }}
        onConfirm={() => {
          if (leaving !== null) {
            run(
              () => revokePlatformAdminAction({ userId: leaving.id }),
              () => {
                setLeaving(null);
              },
            );
          }
        }}
      />
    </DataPanel>
  );
}
