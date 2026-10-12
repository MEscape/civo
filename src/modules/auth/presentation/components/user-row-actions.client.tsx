'use client';

import { useId, useState, useTransition } from 'react';

import { CheckboxField } from '@components/shared/checkbox-field';
import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';

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

  if (user.isSelf) {
    return <span className="text-xs text-copy-muted">{t('users.table.you')}</span>;
  }

  return (
    <div className="space-y-2">
      {isEditing ? (
        <fieldset className="space-y-1" disabled={isPending}>
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
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setIsEditing(true);
            }}
          >
            {t('users.table.editRoles')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (window.confirm(t('users.table.confirmRemove', { name: user.name }))) {
                run(
                  () => removeUserAction({ userId: user.id }),
                  () => undefined,
                );
              }
            }}
          >
            {t('users.table.remove')}
          </Button>
        </div>
      )}
      <FieldMessage
        id={`${id}-error`}
        message={errorCode === null ? undefined : t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        className="text-xs"
      />
    </div>
  );
}
