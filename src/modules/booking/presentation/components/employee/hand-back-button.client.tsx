'use client';

import { ConfirmDialog } from '@components/shared/dialog';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useHandBack } from '../../hooks/use-hand-back';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface HandBackButtonProps {
  readonly bookingId: string;
  /** The service, so the button and the question name the booking. */
  readonly name: string;
}

/** "Termin abgeben": asks first, then gives the booking back; it stays a booking, open for others. */
export function HandBackButton({ bookingId, name }: HandBackButtonProps) {
  const t = useTranslations('booking');
  const handBack = useHandBack(bookingId);

  return (
    <>
      <Button
        type="button"
        variant="destructive-ghost"
        aria-label={t('employee.handBack.triggerNamed', { name })}
        onClick={handBack.open}
      >
        {t('employee.handBack.trigger')}
      </Button>
      <ConfirmDialog
        open={handBack.isOpen}
        title={t('employee.handBack.title')}
        description={t('employee.handBack.description', { name })}
        confirmLabel={t('employee.handBack.confirm')}
        cancelLabel={t('employee.handBack.cancel')}
        isPending={handBack.isPending}
        onConfirm={handBack.confirm}
        onCancel={handBack.cancel}
      >
        {handBack.errorCode !== null && (
          <FieldMessage
            id={`hand-back-error-${bookingId}`}
            message={t(messageKeyForCode(handBack.errorCode), MESSAGE_PARAMS)}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
