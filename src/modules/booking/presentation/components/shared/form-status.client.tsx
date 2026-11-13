'use client';

import { FieldMessage } from '@components/shared/field';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

export interface FormStatusProps {
  /** Names the message for assistive technology: one per form on the page. */
  readonly id: string;
  readonly isDirty: boolean;
  /** The code of a refusal that belongs to no field. */
  readonly formCode: string | null;
}

/** What the foot of a form says: that there is unsaved work, and why the last save was refused. */
export function FormStatus({ id, isDirty, formCode }: FormStatusProps) {
  const t = useTranslations('booking');

  return (
    <>
      {isDirty && <span className="text-copy-muted">{t('form.unsaved')}</span>}
      {formCode !== null && (
        <FieldMessage id={id} message={t(messageKeyForCode(formCode), MESSAGE_PARAMS)} />
      )}
    </>
  );
}
