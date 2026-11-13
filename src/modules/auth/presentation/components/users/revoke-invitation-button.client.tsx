'use client';

import { useId } from 'react';

import { Trash2 } from '@components/icons/icons';
import { ConfirmDialog } from '@components/shared/dialog';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useRevokeInvitation } from '../../hooks/use-revoke-invitation';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface RevokeInvitationButtonProps {
  readonly invitationId: string;
  readonly email: string;
  readonly tenantId?: string | undefined;
}

/** Withdraws a pending invitation behind a question that names it, so its link stops working. */
export function RevokeInvitationButton({
  invitationId,
  email,
  tenantId,
}: RevokeInvitationButtonProps) {
  const t = useTranslations('auth');
  const id = useId();
  const { isAsking, isPending, errorCode, handleOpen, handleCancel, handleConfirm } =
    useRevokeInvitation(invitationId, tenantId);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1" aria-busy={isPending}>
      <Button
        type="button"
        size="sm"
        variant="destructive-ghost"
        disabled={isPending}
        aria-label={t('users.invitations.revoke', { email })}
        onClick={handleOpen}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        {t('users.invitations.withdraw')}
      </Button>
      <FieldMessage
        id={`${id}-error`}
        message={errorCode === null ? undefined : t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
        className="max-w-xs text-right"
      />
      <ConfirmDialog
        open={isAsking}
        isPending={isPending}
        title={t('users.invitations.confirmTitle')}
        description={t('users.invitations.confirmDescription', { email })}
        confirmLabel={t('users.invitations.confirm')}
        cancelLabel={t('users.invitations.cancel')}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
