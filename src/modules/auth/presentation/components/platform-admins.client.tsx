'use client';

import { useId, useState, useTransition } from 'react';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { grantPlatformAdminAction } from '../actions/grant-platform-admin-action';
import { revokePlatformAdminAction } from '../actions/revoke-platform-admin-action';

import type { PlatformAdminView } from '../../application/contracts/platform-admin-views';

export interface PlatformAdminsPanelProps {
  readonly admins: readonly PlatformAdminView[];
  /** The signed-in person: nobody revokes themselves. */
  readonly selfId: string;
}

/** Who administers the platform by membership, with "add" by e-mail address and "remove". */
export function PlatformAdminsPanel({ admins, selfId }: PlatformAdminsPanelProps) {
  const t = useTranslations('auth');
  const id = useId();
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof grantPlatformAdminAction>, onDone?: () => void) {
    setProblem(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone?.();
      } else {
        setProblem(t('platformAdmins.failed'));
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4">
      <div>
        <h2 id={`${id}-title`} className="font-heading text-lg font-semibold text-copy">
          {t('platformAdmins.title')}
        </h2>
        <p className="text-sm text-copy-muted">{t('platformAdmins.description')}</p>
      </div>

      <ul className="divide-y divide-border rounded-token border border-border">
        {admins.map((admin) => (
          <li key={admin.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="text-sm text-copy">
              {admin.name} <span className="text-copy-muted">{admin.email}</span>
            </span>
            {admin.id !== selfId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  run(() => revokePlatformAdminAction({ userId: admin.id }));
                }}
              >
                {t('platformAdmins.remove')}
                <span className="sr-only"> {admin.email}</span>
              </Button>
            )}
          </li>
        ))}
        {admins.length === 0 && (
          <li className="p-3 text-sm text-copy-muted">{t('platformAdmins.none')}</li>
        )}
      </ul>

      <form
        noValidate
        aria-busy={isPending}
        className="flex flex-wrap items-end gap-3"
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
        <TextField
          id={`${id}-email`}
          label={t('platformAdmins.email')}
          hint={t('platformAdmins.emailHint')}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <Button type="submit" disabled={isPending || email.trim() === ''}>
          {t('platformAdmins.add')}
        </Button>
      </form>
      {problem !== null && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </section>
  );
}
