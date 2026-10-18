'use client';

import { useId, useState, useTransition } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { ConfirmDialog } from '@components/shared/confirm-dialog';
import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Pencil, Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { ROLES } from '../../application/contracts/auth-constraints';
import { changeUserRolesAction } from '../actions/change-user-roles-action';
import { removeUserAction } from '../actions/remove-user-action';
import { MESSAGE_PARAMS, ROLE_MESSAGE_KEYS, messageKeyForCode } from '../messages/message-keys';

import type { UserRowDto } from '../dto/user-dto';

export interface UserRowActionsProps {
  readonly user: UserRowDto;
}

/**
 * Change the roles of one member or remove them from the tenant. Rendered only
 * for people who may manage users and never for oneself; the use cases refuse
 * the same things regardless of what this screen shows.
 */
export function UserRowActions({ user }: UserRowActionsProps) {
  const t = useTranslations('auth');
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [roles, setRoles] = useState<readonly string[]>(user.roles);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);

  function run(action: () => ReturnType<typeof removeUserAction>, onDone: () => void) {
    setErrorCode(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onDone();
        return;
      }
      setErrorCode(result.error.code);
    });
  }

  // The name cell already says "you"; nobody changes or removes themselves here.
  if (user.isSelf) {
    return null;
  }

  return (
    <div className="space-y-2 text-left">
      {isEditing ? (
        <fieldset
          className="ml-auto w-fit space-y-1 rounded-token border border-border bg-canvas p-3"
          disabled={isPending}
        >
          <legend className="sr-only">{t('users.table.rolesOf', { name: user.name })}</legend>
          {ROLES.map((role) => (
            <CheckboxField
              key={role}
              id={`${id}-${role}`}
              label={t(ROLE_MESSAGE_KEYS[role])}
              checked={roles.includes(role)}
              onChange={(event) => {
                setRoles((current) =>
                  event.target.checked
                    ? [...current, role]
                    : current.filter((candidate) => candidate !== role),
                );
              }}
            />
          ))}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={roles.length === 0}
              onClick={() => {
                run(
                  () => changeUserRolesAction({ userId: user.id, roles }),
                  () => {
                    setIsEditing(false);
                  },
                );
              }}
            >
              {t('users.table.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRoles(user.roles);
                setIsEditing(false);
              }}
            >
              {t('users.table.cancel')}
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsEditing(true);
            }}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('users.table.editRoles')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive-ghost"
            disabled={isPending}
            onClick={() => {
              setIsConfirmingRemove(true);
            }}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('users.table.remove')}
            <span className="sr-only"> {user.name}</span>
          </Button>
        </div>
      )}
      <FieldMessage
        id={`${id}-error`}
        message={errorCode === null ? undefined : t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        className="text-right text-xs"
      />
      <ConfirmDialog
        open={isConfirmingRemove}
        title={t('users.table.removeTitle', { name: user.name })}
        description={t('users.table.confirmRemove', { name: user.name })}
        confirmLabel={t('users.table.remove')}
        cancelLabel={t('users.table.cancel')}
        onCancel={() => {
          setIsConfirmingRemove(false);
        }}
        onConfirm={() => {
          // Closed at once, so a refusal shows in the row instead of behind the dialog.
          setIsConfirmingRemove(false);
          run(
            () => removeUserAction({ userId: user.id }),
            () => undefined,
          );
        }}
      />
    </div>
  );
}
