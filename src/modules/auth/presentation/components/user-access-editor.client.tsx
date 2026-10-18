'use client';

import { useState, useTransition } from 'react';

import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { FieldMessage } from '@components/shared/field-message';
import { SelectField } from '@components/shared/select-field';
import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Info, Pencil } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { removeUserAccessAction } from '../actions/remove-user-access-action';
import { setUserAccessAction } from '../actions/set-user-access-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import { WebsiteAccessCard } from './website-access-card';

import type { AccessChange } from './website-access-card';
import type { TenantRole } from '../../application/contracts/auth-constraints';

export interface AccessWebsite {
  readonly id: string;
  readonly name: string;
}

export interface UserAccessEditorProps {
  readonly userId: string;
  readonly userName: string;
  readonly userEmail: string;
  /** A platform administrator works in every website already; the dialog says so. */
  readonly isPlatformAdmin: boolean;
  /** Where the person works now, with their roles. */
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly roles: readonly TenantRole[];
  }>;
  /** Every website a person can be given access to. */
  readonly websites: readonly AccessWebsite[];
}

type Draft = ReadonlyMap<string, readonly TenantRole[]>;

/** The role a person starts with in a website that is added: the one that changes nothing. */
const STARTING_ROLE: TenantRole = 'viewer';

const sameRoles = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((role) => b.includes(role));

/**
 * "Manage access" of one person: a dialog that lists the websites they work
 * in with their roles (each saying what it allows), lets a platform
 * administrator change the roles, take a website away or add one, and saves
 * only what changed, counting it as it goes. Every change is checked again by
 * the server, which also keeps each website's last administrator.
 */
export function UserAccessEditor({
  userId,
  userName,
  userEmail,
  isPlatformAdmin,
  memberships,
  websites,
}: UserAccessEditorProps) {
  const t = useTranslations('auth');
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(new Map());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [toAdd, setToAdd] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const original = new Map(memberships.map(({ tenantId, roles }) => [tenantId, roles]));
  const nameOf = (tenantId: string) =>
    websites.find((website) => website.id === tenantId)?.name ?? tenantId;
  const addable = websites.filter((website) => !draft.has(website.id));

  function changeOf(tenantId: string, roles: readonly TenantRole[]): AccessChange {
    if (removed.has(tenantId)) {
      return 'removed';
    }
    const before = original.get(tenantId);
    if (before === undefined) {
      return 'new';
    }
    return sameRoles(before, roles) ? 'none' : 'changed';
  }

  const changeCount = [...draft].filter(
    ([tenantId, roles]) => changeOf(tenantId, roles) !== 'none',
  ).length;

  function open() {
    setDraft(new Map(original));
    setRemoved(new Set());
    setToAdd('');
    setErrorText(null);
    setIsOpen(true);
  }

  function toggleRole(tenantId: string, role: TenantRole, isChecked: boolean) {
    const current = draft.get(tenantId) ?? [];
    const next = isChecked ? [...current, role] : current.filter((held) => held !== role);
    setDraft(new Map(draft).set(tenantId, next));
  }

  function toggleRemoved(tenantId: string) {
    if (!original.has(tenantId)) {
      // A website that was only just added has nothing stored to take away: drop the row.
      const next = new Map(draft);
      next.delete(tenantId);
      setDraft(next);
      return;
    }
    const next = new Set(removed);
    if (!next.delete(tenantId)) {
      next.add(tenantId);
    }
    setRemoved(next);
  }

  function addWebsite(tenantId: string) {
    setDraft(new Map(draft).set(tenantId, [STARTING_ROLE]));
    setToAdd('');
  }

  function save() {
    const kept = [...draft].filter(([tenantId]) => !removed.has(tenantId));
    if (kept.some(([, roles]) => roles.length === 0)) {
      setErrorText(t('platformUsers.access.needRole'));
      return;
    }
    const changes = [
      ...kept
        .filter(([tenantId, roles]) => changeOf(tenantId, roles) !== 'none')
        .map(
          ([tenantId, roles]) =>
            () =>
              setUserAccessAction({ userId, tenantId, roles }),
        ),
      ...[...removed].map((tenantId) => () => removeUserAccessAction({ userId, tenantId })),
    ];
    setErrorText(null);
    startTransition(async () => {
      for (const change of changes) {
        const result = await change();
        if (!result.ok) {
          setErrorText(t(messageKeyForCode(result.error.code), MESSAGE_PARAMS));
          return;
        }
      }
      setIsOpen(false);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={open}>
        <Pencil className="size-3.5" aria-hidden="true" />
        {t('platformUsers.table.manage')}
        <span className="sr-only"> {userName}</span>
      </Button>
      <ConfirmDialog
        open={isOpen}
        size="lg"
        title={t('platformUsers.access.title', { name: userName })}
        description={userEmail}
        confirmLabel={
          changeCount === 0
            ? t('platformUsers.access.save')
            : t('platformUsers.access.saveCount', { count: changeCount })
        }
        confirmVariant="default"
        cancelLabel={t('platformUsers.access.cancel')}
        isPending={isPending}
        onConfirm={() => {
          if (changeCount === 0) {
            setIsOpen(false);
            return;
          }
          save();
        }}
        onCancel={() => {
          setIsOpen(false);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-copy-muted">{t('platformUsers.access.description')}</p>
          {isPlatformAdmin && (
            <Alert variant="info" role="note">
              <Info className="size-4" aria-hidden="true" />
              <div className="text-sm">{t('platformUsers.access.platformAdminNote')}</div>
            </Alert>
          )}
          {draft.size === 0 && (
            <p className="rounded-token border border-dashed border-border px-4 py-6 text-center text-sm text-copy-muted">
              {t('platformUsers.access.empty')}
            </p>
          )}
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {[...draft].map(([tenantId, roles]) => (
              <WebsiteAccessCard
                key={tenantId}
                idPrefix={`${userId}-${tenantId}`}
                websiteName={nameOf(tenantId)}
                roles={roles}
                change={changeOf(tenantId, roles)}
                onToggleRole={(role, isChecked) => {
                  toggleRole(tenantId, role, isChecked);
                }}
                onToggleRemoved={() => {
                  toggleRemoved(tenantId);
                }}
              />
            ))}
          </ul>

          <div className="rounded-token border border-dashed border-border bg-canvas p-3">
            {addable.length === 0 ? (
              <p className="text-sm text-copy-muted">{t('platformUsers.access.nothingToAdd')}</p>
            ) : (
              <SelectField
                id={`${userId}-add`}
                label={t('platformUsers.access.addTitle')}
                placeholder={t('platformUsers.access.addWebsite')}
                options={addable.map((website) => ({ value: website.id, label: website.name }))}
                value={toAdd}
                onValueChange={addWebsite}
              />
            )}
          </div>
          <FieldMessage id={`${userId}-access-error`} message={errorText} className="text-sm" />
        </div>
      </ConfirmDialog>
    </>
  );
}
